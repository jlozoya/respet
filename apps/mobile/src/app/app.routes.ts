import type { Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guard';

/**
 * Rutas de la aplicación.
 *
 * Todas cargan su componente de forma perezosa con `loadComponent`. El proyecto
 * anterior usaba la sintaxis de cadena `'./ruta/x.module#XModule'`, que Angular
 * retiró en la versión 11 y que además obligaba a mantener un `NgModule` por
 * pantalla sin más función que declararla.
 */
export const routes: Routes = [
  {
    // El muro es la portada: entrar en la aplicación es entrar en él, sin un
    // salto intermedio a otra dirección. Quien llega sin sesión no ve un muro
    // a medias, sino la pantalla de acceso, que es lo que hace cualquier red
    // social: aquí se viene a participar, y para eso hace falta una cuenta.
    path: '',
    title: 'Muro',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/wall/wall.page').then((m) => m.WallPage),
  },
  {
    // Donde vivía antes. Se queda como redirección porque hay enlaces
    // compartidos y marcadores apuntando ahí.
    path: 'wall',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    /*
     * El muro de otra persona.
     *
     * Es la misma pantalla que el muro, con su ficha arriba y filtrada por
     * autor; lo que cambia es que tiene dirección propia. Antes se llegaba con
     * `/?userId=…`, y eso metía a una persona concreta dentro de la portada,
     * que es de todos.
     */
    path: 'profile/:userId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/wall/wall.page').then((m) => m.WallPage),
  },
  {
    // El detalle de una publicación: destino de los enlaces que se comparten.
    // Sigue colgando de `wall` en lugar de subir a la raíz: un `:id` suelto
    // arriba se tragaría cualquier ruta que se añadiera después.
    path: 'wall/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/post/post.page').then((m) => m.PostPage),
  },
  {
    path: 'main',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/main/main.page').then((m) => m.MainPage),
  },
  // Lo que se puede leer sin cuenta es lo que cuenta qué es esto y bajo qué
  // condiciones: la presentación, el quiénes somos y los textos legales. Son
  // los enlaces del pie de la pantalla de acceso.
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.page').then((m) => m.AboutPage),
  },
  {
    path: 'tutorial',
    loadComponent: () => import('./pages/tutorial/tutorial.page').then((m) => m.TutorialPage),
  },
  {
    path: 'bulletins',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/bulletins/bulletins.page').then((m) => m.BulletinsPage),
  },
  {
    path: 'politics/:segment',
    loadComponent: () => import('./pages/politics/politics.page').then((m) => m.PoliticsPage),
  },
  {
    path: 'terms-and-conditions/:segment',
    loadComponent: () =>
      import('./pages/terms-and-conditions/terms-and-conditions.page').then(
        (m) => m.TermsAndConditionsPage,
      ),
  },

  // --- Acceso ---------------------------------------------------------------
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/signup/signup.page').then((m) => m.SignupPage),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
  },

  // --- Chat -----------------------------------------------------------------
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/chat/conversations/conversations.page').then((m) => m.ConversationsPage),
  },
  {
    path: 'chat/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/chat/conversation/conversation.page').then((m) => m.ConversationPage),
  },

  // --- Cuenta ---------------------------------------------------------------
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/user/account/account.page').then((m) => m.AccountPage),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/user/settings/settings.page').then((m) => m.SettingsPage),
  },

  // --- Tienda ---------------------------------------------------------------
  {
    path: 'warehouses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/warehouses/warehouses.page').then((m) => m.WarehousesPage),
  },
  {
    path: 'products',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/products/products.page').then((m) => m.ProductsPage),
  },
  {
    path: 'cart',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/cart/cart.page').then((m) => m.CartPage),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/orders/orders/orders.page').then((m) => m.OrdersPage),
  },
  {
    path: 'orders/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/orders/order/order.page').then((m) => m.OrderPage),
  },

  // --- Administración -------------------------------------------------------
  {
    path: 'analytics',
    canActivate: [roleGuard('admin')],
    loadComponent: () =>
      import('./pages/admin/analytics/analytics.page').then((m) => m.AnalyticsPage),
  },
  {
    path: 'users',
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/admin/users/users.page').then((m) => m.UsersPage),
  },
  {
    // La ficha de otro usuario reutiliza la pantalla de cuenta, que se pone en
    // modo lectura y edición administrativa cuando recibe un `id`.
    path: 'users/:id',
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/user/account/account.page').then((m) => m.AccountPage),
  },

  {
    path: 'error',
    loadComponent: () => import('./pages/error/error.page').then((m) => m.ErrorPage),
  },
  {
    path: '**',
    redirectTo: 'error',
  },
];
