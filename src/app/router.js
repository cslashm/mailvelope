/**
 * Mailvelope - secure email with OpenPGP encryption for Webmail
 * Copyright (C) 2017 Mailvelope GmbH
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {Switch, Route, HashRouter} from 'react-router-dom';
import {App} from './app';
import InstallLandingPage from './install/components/LandingPage';

document.addEventListener('DOMContentLoaded', init);

function init() {
  if (document.body.dataset.mvelo) {
    return;
  }
  document.body.dataset.mvelo = true;
  const root = document.createElement('div');
  ReactDOM.render((
    <HashRouter>
      <Switch>
        <Route exact path="/install" component={InstallLandingPage} />
        <Route path="/" component={App} />
      </Switch>
    </HashRouter>
  ), document.body.appendChild(root));
}
