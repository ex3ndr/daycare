/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams: { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `${'/(app)'}` | `/`; params?: Router.UnknownInputParams; } | { pathname: `${'/(auth)'}/auth` | `/auth`; params?: Router.UnknownInputParams; } | { pathname: `${'/(auth)'}` | `/`; params?: Router.UnknownInputParams; };
      hrefOutputParams: { pathname: Router.RelativePathString, params?: Router.UnknownOutputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownOutputParams } | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams; } | { pathname: `${'/(app)'}` | `/`; params?: Router.UnknownOutputParams; } | { pathname: `${'/(auth)'}/auth` | `/auth`; params?: Router.UnknownOutputParams; } | { pathname: `${'/(auth)'}` | `/`; params?: Router.UnknownOutputParams; };
      href: Router.RelativePathString | Router.ExternalPathString | `/_sitemap${`?${string}` | `#${string}` | ''}` | `${'/(app)'}${`?${string}` | `#${string}` | ''}` | `/${`?${string}` | `#${string}` | ''}` | `${'/(auth)'}/auth${`?${string}` | `#${string}` | ''}` | `/auth${`?${string}` | `#${string}` | ''}` | `${'/(auth)'}${`?${string}` | `#${string}` | ''}` | `/${`?${string}` | `#${string}` | ''}` | { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `${'/(app)'}` | `/`; params?: Router.UnknownInputParams; } | { pathname: `${'/(auth)'}/auth` | `/auth`; params?: Router.UnknownInputParams; } | { pathname: `${'/(auth)'}` | `/`; params?: Router.UnknownInputParams; };
    }
  }
}
