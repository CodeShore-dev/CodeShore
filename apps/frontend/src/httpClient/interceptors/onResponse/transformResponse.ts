import { AxiosResponse } from 'axios';

import { Response } from '../../../@types';

export default (response: AxiosResponse<Response>) => {
  return { ...response, data: response.data.data };
};
