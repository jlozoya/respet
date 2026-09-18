import type { Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guard';

/**
 * Rutas de la aplicación.
 *
 * Todas cargan su pantalla de forma perezosa: quien sólo mira el muro no
 * descarga el estudio de directos ni el portal para desarrolladores.
 */
export const routes: Routes = [
  // --- Red social -----------------------------------------------------------
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  { path: 'wall', redirectTo: '', pathMatch: 'full' },
  { path: 'main', redirectTo: '', pathMatch: 'full' },
  {
    path: 'explore',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/explore/explore.page').then((m) => m.ExplorePage),
  },
  {
    path: 'search',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/search/search.page').then((m) => m.SearchPage),
  },
  {
    path: 'hashtag/:tag',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/hashtag/hashtag.page').then((m) => m.HashtagPage),
  },
  {
    path: 'post/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/post/post-detail.page').then((m) => m.PostDetailPage),
  },
  // Los enlaces compartidos antes de la red social apuntaban aquí.
  { path: 'wall/:id', redirectTo: 'post/:id' },
  {
    path: 'profile/:handle',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'saved',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/saved/saved.page').then((m) => m.SavedPage),
  },
  {
    path: 'follow-requests',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/follow-requests/follow-requests.page').then((m) => m.FollowRequestsPage),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/notifications/notifications.page').then((m) => m.NotificationsPage),
  },
  {
    path: 'messages',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/messages/messages.page').then((m) => m.MessagesPage),
  },
  {
    path: 'messages/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/messages/messages.page').then((m) => m.MessagesPage),
  },
  { path: 'chat', redirectTo: 'messages', pathMatch: 'full' },
  { path: 'chat/:id', redirectTo: 'messages/:id' },
  {
    path: 'stories/archive',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/stories/story-archive.page').then((m) => m.StoryArchivePage),
  },
  {
    path: 'live',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/live/live-list.page').then((m) => m.LiveListPage),
  },
  {
    path: 'live/new',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/live/live-studio.page').then((m) => m.LiveStudioPage),
  },
  {
    path: 'live/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/live/live-watch.page').then((m) => m.LiveWatchPage),
  },
  {
    path: 'menu',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/menu/menu.page').then((m) => m.MenuPage),
  },

  // --- Configuración --------------------------------------------------------
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'settings/profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/profile-settings.page').then((m) => m.ProfileSettingsPage),
  },
  {
    path: 'settings/account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/account-settings.page').then((m) => m.AccountSettingsPage),
  },
  {
    path: 'settings/privacy',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/privacy-settings.page').then((m) => m.PrivacySettingsPage),
  },
  {
    path: 'settings/security',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/security-settings.page').then((m) => m.SecuritySettingsPage),
  },
  {
    path: 'settings/apps',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/apps-settings.page').then((m) => m.AppsSettingsPage),
  },
  {
    path: 'settings/blocked',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/blocked-settings.page').then((m) => m.BlockedSettingsPage),
  },
  {
    path: 'settings/preferences',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/preferences-settings.page').then((m) => m.PreferencesSettingsPage),
  },
  { path: 'account', redirectTo: 'settings', pathMatch: 'full' },
  { path: 'account/:section', redirectTo: 'settings' },

  // --- Plataforma para desarrolladores --------------------------------------
  {
    path: 'developers',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/developers/developers.page').then((m) => m.DevelopersPage),
  },
  {
    path: 'developers/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/developers/developer-app.page').then((m) => m.DeveloperAppPage),
  },
  {
    path: 'oauth/authorize',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/oauth/authorize.page').then((m) => m.AuthorizePage),
  },

  // --- Acceso ---------------------------------------------------------------
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/signup.page').then((m) => m.SignupPage),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/auth/reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/auth/verify-email.page').then((m) => m.VerifyEmailPage),
  },

  // --- Tienda ---------------------------------------------------------------
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
  {
    path: 'warehouses',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/warehouses/warehouses.page').then((m) => m.WarehousesPage),
  },

  // --- Administración -------------------------------------------------------
  {
    path: 'admin/reports',
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/admin/reports/reports.page').then((m) => m.ReportsPage),
  },
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
    path: 'users/:id',
    canActivate: [roleGuard('admin')],
    loadComponent: () =>
      import('./pages/admin/user-detail/user-detail.page').then((m) => m.UserDetailPage),
  },
  {
    path: 'bulletins',
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/bulletins/bulletins.page').then((m) => m.BulletinsPage),
  },

  // --- Lo que se lee sin cuenta ---------------------------------------------
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.page').then((m) => m.AboutPage),
  },
  {
    path: 'tutorial',
    loadComponent: () => import('./pages/tutorial/tutorial.page').then((m) => m.TutorialPage),
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
  {
    path: 'error',
    loadComponent: () => import('./pages/error/error.page').then((m) => m.ErrorPage),
  },
  { path: '**', redirectTo: 'error' },
];
