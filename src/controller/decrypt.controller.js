/**
 * Copyright (C) 2015-2017 Mailvelope GmbH
 * Licensed under the GNU Affero General Public License version 3
 */

import mvelo from 'lib-mvelo';
import {prefs} from '../modules/prefs';
import * as model from '../modules/pgpModel';
import * as sub from './sub.controller';
import * as uiLog from '../modules/uiLog';
import {triggerSync} from './sync.controller';
import mailreader from 'mailreader-parser';

export default class DecryptController extends sub.SubController {
  constructor(port) {
    super(port);
    this.pwdControl = null;
    this.decryptPopup = null;
    this.options = {};
    this.keyringId = mvelo.LOCAL_KEYRING_ID;
    this.isContainer = this.mainType === 'decryptCont'; // main view is a container component
  }

  handlePortMessage(msg) {
    switch (msg.event) {
      // done
      case 'decrypt-dialog-cancel':
        this.dialogCancel();
        break;
      // done
      case 'decrypt-inline-init':
        if (mvelo.windows.modalActive && !this.decryptPopup) {
          // password dialog or modal dialog already open from other component
          if (this.ports.dFrame) {
            this.ports.dFrame.postMessage({event: 'remove-dialog'});
          } else if (this.ports.decryptCont) {
            this.ports.decryptCont.postMessage({event: 'error-message', error: 'modal-active'});
          }
        } else {
          const port = this.ports.dFrame || this.ports.decryptCont;
          // get armored message
          port.postMessage({event: 'get-armored'});
        }
        break;
      case 'dframe-display-popup':
        // decrypt popup potentially needs pwd dialog
        if (mvelo.windows.modalActive) {
          // password dialog or modal dialog already open
          this.ports.dFrame.postMessage({event: 'remove-dialog'});
        } else {
          mvelo.windows.openPopup(`components/decrypt-popup/decryptPopup.html?id=${this.id}`, {width: 742, height: 550, modal: true})
          .then(popup => {
            this.decryptPopup = popup;
            popup.addRemoveListener(() => {
              this.ports.dFrame.postMessage({event: 'dialog-cancel'});
              this.decryptPopup = null;
            });
          });
        }
        break;
      case 'set-armored':
        this.options = msg.options;
        if (msg.keyringId) {
          this.keyringId = msg.keyringId;
        }
        this.decrypt(msg.data, this.keyringId);
        break;
      case 'decrypt-inline-user-input':
        uiLog.push(msg.source, msg.type);
        break;
      case 'open-security-settings':
        this.openSecuritySettings();
        break;
      default:
        console.log('unknown event', msg);
    }
  }

  dialogCancel() {
    // forward event to decrypt frame
    this.ports.dFrame.postMessage({event: 'dialog-cancel'});
    if (this.decryptPopup) {
      this.decryptPopup.close();
      this.decryptPopup = null;
    }
  }

  decrypt(armored, keyringId) {
    model.readMessage({armoredText: armored, keyringId})
    .then(message => this.prepareKey(message))
    .then(message => {
      triggerSync(message);
      return this.decryptMessage(message);
    })
    .then(content => {
      const ports = this.ports;
      const handlers = {
        noEvent: true,
        onMessage(msg) {
          this.noEvent = false;
          ports.dDialog.postMessage({event: 'decrypted-message', message: msg});
        },
        onAttachment(part) {
          this.noEvent = false;
          ports.dDialog.postMessage({event: 'add-decrypted-attachment', message: part});
        }
      };
      if (this.ports.dDialog && content.signatures) {
        this.ports.dDialog.postMessage({event: 'signature-verification', signers: content.signatures, isContainer: this.isContainer});
      }
      return this.parseMessage(content.text, handlers, 'html');
    })
    .then(() => {
      if (this.ports.decryptCont) {
        this.ports.decryptCont.postMessage({event: 'decrypt-done'});
      }
    })
    .catch(error => {
      if (error.code === 'PWD_DIALOG_CANCEL') {
        if (this.ports.dFrame) {
          return this.dialogCancel();
        }
      }
      if (this.ports.dDialog) {
        this.ports.dDialog.postMessage({event: 'error-message', error: error.message});
      }
      if (this.ports.decryptCont) {
        error = error || {};
        switch (error.code) {
          case 'ARMOR_PARSE_ERROR':
          case 'PWD_DIALOG_CANCEL':
          case 'NO_KEY_FOUND':
            error = mvelo.util.mapError(error);
            break;
          default:
            error = {
              // don't expose internal errors to API
              code: 'DECRYPT_ERROR',
              message: 'Generic decrypt error'
            };
        }
        this.ports.decryptCont.postMessage({event: 'error-message', error});
      }
    })
    .then(() => {
      this.ports.dPopup && this.ports.dPopup.postMessage({event: 'show-message'});
    });
  }

  prepareKey(message, openPopup) {
    this.pwdControl = sub.factory.get('pwdDialog');
    message.reason = 'PWD_DIALOG_REASON_DECRYPT';
    message.openPopup = openPopup !== undefined ? openPopup : this.ports.decryptCont || prefs.security.display_decrypted == mvelo.DISPLAY_INLINE;
    message.beforePasswordRequest = () => {
      this.ports.dPopup && this.ports.dPopup.postMessage({event: 'show-pwd-dialog', id: this.pwdControl.id});
    };
    message.keyringId = this.keyringId;
    return this.pwdControl.unlockKey(message);
  }

  decryptMessage(message) {
    return new Promise((resolve, reject) => {
      message.options = message.options || this.options;
      model.decryptMessage(message, this.keyringId, (err, content) => {
        if (err) {
          return reject(err);
        }
        resolve(content);
      });
    });
  }

  // attribution: https://github.com/whiteout-io/mail-html5
  filterBodyParts(bodyParts, type, result) {
    result = result || [];
    bodyParts.forEach(part => {
      if (part.type === type) {
        result.push(part);
      } else if (Array.isArray(part.content)) {
        this.filterBodyParts(part.content, type, result);
      }
    });
    return result;
  }

  /**
   * handlers: onAttachment, onMessage
   */
  parseMessage(rawText, handlers, encoding) {
    if (/^\s*(MIME-Version|Content-Type|Content-Transfer-Encoding|From|Date):/.test(rawText)) {
      return this.parseMIME(rawText, handlers, encoding);
    } else {
      return this.parseInline(rawText, handlers, encoding);
    }
  }

  parseMIME(rawText, handlers, encoding) {
    return new Promise(resolve => {
      // mailreader expects rawText in pseudo-binary
      rawText = unescape(encodeURIComponent(rawText));
      mailreader.parse([{raw: rawText}], parsed => {
        if (parsed && parsed.length > 0) {
          const htmlParts = [];
          const textParts = [];
          if (encoding === 'html') {
            this.filterBodyParts(parsed, 'html', htmlParts);
            if (htmlParts.length) {
              const sanitized = mvelo.util.parseHTML(htmlParts.map(part => part.content).join('\n<hr>\n'));
              handlers.onMessage(sanitized);
            } else {
              this.filterBodyParts(parsed, 'text', textParts);
              if (textParts.length) {
                handlers.onMessage(textParts.map(part => mvelo.util.text2html(part.content)).join('<hr>'));
              }
            }
          } else if (encoding === 'text') {
            this.filterBodyParts(parsed, 'text', textParts);
            if (textParts.length) {
              handlers.onMessage(textParts.map(part => part.content).join('\n\n'));
            } else {
              this.filterBodyParts(parsed, 'html', htmlParts);
              if (htmlParts.length) {
                handlers.onMessage(htmlParts.map(part => mvelo.util.html2text(part.content)).join('\n\n'));
              }
            }
          }
          const attachmentParts = [];
          this.filterBodyParts(parsed, 'attachment', attachmentParts);
          attachmentParts.forEach(part => {
            part.filename = mvelo.util.encodeHTML(part.filename);
            part.content = mvelo.util.ab2str(part.content.buffer);
            handlers.onAttachment(part);
          });
        }
        if (handlers.noEvent) {
          handlers.onMessage('');
        }
        resolve();
      });
    });
  }

  parseInline(rawText, handlers, encoding) {
    return new Promise(resolve => {
      if (/(<\/a>|<br>|<\/div>|<\/p>|<\/b>|<\/u>|<\/i>|<\/ul>|<\/li>)/.test(rawText)) {
        // legacy html mode
        if (encoding === 'html') {
          const sanitized = mvelo.util.parseHTML(rawText);
          handlers.onMessage(sanitized);
          resolve();
        } else if (encoding === 'text') {
          handlers.onMessage(mvelo.util.html2text(rawText));
          resolve();
        }
      } else {
        // plain text
        if (encoding === 'html') {
          handlers.onMessage(mvelo.util.text2html(rawText));
        } else if (encoding === 'text') {
          handlers.onMessage(rawText);
        }
        resolve();
      }
    });
  }
}
