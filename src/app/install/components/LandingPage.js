/**
 * Copyright (C) 2016 Mailvelope GmbH
 * Licensed under the GNU Affero General Public License version 3
 */

import React, {Component} from 'react';
import * as l10n from '../../../lib/l10n';
import moment from 'moment';
import 'font-awesome/css/font-awesome.min.css';
import cyrptographyIcon from '../../../img/cryptography-icon48.png';
import screenshot from '../../../img/mailvelope_screenshot.png';
import './LandingPage.css';

'use strict';

l10n.register([]);

// set locale
moment.locale(navigator.language);

export default class LandingPage extends Component {
  render() {
    const mailvelopeHelpUrl = "https://www.mailvelope.com/en/help";
    return (
      <div className="container">
        <nav className="navbar navbar-default navbar-fixed-top">
          <div className="container">
            <div className="navbar-header">
              <div className="navbar-brand settings-logo"></div>
            </div>
          </div>
        </nav>
        <div className="landingpage">
          <div className="col-md-10">
            <h1>Welcome to Mailvelope!</h1>
            <p>Click on the mailvelope icon <span className="mailvelopeicon">
              <img src={cyrptographyIcon}height="25px"></img></span>
              in your browser toolbar to begin with the configuration.
            </p>
            <p>
              <img src={screenshot} alt="Illustration of clicking on the mailvelope icon" className="gif-illustration"/>
            </p>
            <p>Check out the <a href={mailvelopeHelpUrl}>online help</a> for more information.</p>
          </div>
          <div className="col-md-2">
            <div className="illustration"><i className="fa fa-arrow-up" aria-hidden="true"></i></div>
          </div>
        </div>
      </div>
    );
  }
}
