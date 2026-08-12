import { Injectable } from '@angular/core';

export interface InitParams {
  appId: string;
  xfbml?: boolean;
  version: string;
}

export interface LoginResponse {
  status: string;
  authResponse: { accessToken: string; userID: string };
}

interface FacebookSdk {
  init(params: InitParams): void;
  login(callback: (response: LoginResponse) => void, options: object): void;
  logout(callback: (response: unknown) => void): void;
  api(path: string, method: string, params: object, callback: (response: any) => void): void;
  ui(params: object, callback: (response: any) => void): void;
}

@Injectable({ providedIn: 'root' })
export class FacebookService {
  init(params: InitParams): void {
    this.sdk.init(params);
  }

  login(options: object): Promise<LoginResponse> {
    return new Promise(resolve => this.sdk.login(resolve, options));
  }

  logout(): Promise<unknown> {
    return new Promise(resolve => this.sdk.logout(resolve));
  }

  api(path: string, method: string, params: object): Promise<any> {
    return new Promise(resolve => this.sdk.api(path, method, params, resolve));
  }

  ui(params: object): Promise<any> {
    return new Promise(resolve => this.sdk.ui(params, resolve));
  }

  private get sdk(): FacebookSdk {
    const sdk = (window as Window & { FB?: FacebookSdk }).FB;
    if (!sdk) {
      throw new Error('Facebook SDK is not available');
    }
    return sdk;
  }
}
