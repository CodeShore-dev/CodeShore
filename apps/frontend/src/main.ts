import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { createHttpClient } from './httpClient';
import addAuthorizationHeader from './httpClient/interceptors/onRequest/addAuthorizationHeader';
import errorHandleResponse from './httpClient/interceptors/onResponse/errorHandleResponse';
import transformResponse from './httpClient/interceptors/onResponse/transformResponse';
import beforeCreate from './httpClient/lifecycle/beforeCreate';
import router from './router';
import './styles.css';

const app = createApp(App);
const pinia = createPinia();

createHttpClient(
  { beforeCreate },
  {
    request: {
      usesOnFullFilled: [addAuthorizationHeader],
    },
    response: {
      usesOnFullFilled: [transformResponse],
      usesOnRejected: [errorHandleResponse],
    },
  },
);

app.use(pinia);
app.use(router);
app.mount('#root');
