/**
 * Mailvelope - secure email with OpenPGP encryption for Webmail
 * Copyright (C) 2012-2017 Mailvelope GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {initController} from './controller/main.controller';
import {initScriptInjection} from './lib/inject';

initController().then(initScriptInjection);

// Open the install landing page right after the plugin is installed.
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason == "install") {
    chrome.tabs.create({
      url: "/app/app.html#/install"
    });
  }
});
