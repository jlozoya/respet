import { environment } from './../environments/environment';
import { AdminGuard } from './providers/guards/admin.guard';
import { SesionGuard } from './providers/guards/sesion.guard';
import { NgModule } from '@angular/core';
import { Routes, RouterModule, PreloadAllModules } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: environment.MAIN_URL,
    pathMatch: 'full'
  },
  {
    path: 'main',
    loadChildren: () => import('./pages/main/main.module').then(m => m.MainPageModule),
  },
  {
    path: 'account',
    canActivate: [SesionGuard],
    loadChildren: () => import('./pages/user/account/account.module').then(m => m.AccountPageModule),
  },
  {
    path: 'account/:user_id',
    canActivate: [SesionGuard, AdminGuard],
    loadChildren: () => import('./pages/user/account/account.module').then(m => m.AccountPageModule),
  },
  {
    path: 'about',
    loadChildren: () => import('./pages/about/about.module').then(m => m.AboutPageModule),
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule),
  },
  {
    path: 'login/:token',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule),
  },
  {
    path: 'signup',
    loadChildren: () => import('./pages/signup/signup.module').then(m => m.SignupPageModule),
  },
  {
    path: 'signup/:token',
    loadChildren: () => import('./pages/signup/signup.module').then(m => m.SignupPageModule),
  },
  {
    path: 'analytics',
    canActivate: [SesionGuard, AdminGuard],
    loadChildren: () => import('./pages/admin/analytics/analytics.module').then(m => m.AnalyticsPageModule),
  },
  {
    path: 'users',
    canActivate: [SesionGuard, AdminGuard],
    loadChildren: () => import('./pages/admin/users/users.module').then(m => m.UsersPageModule),
  },
  {
    path: 'tutorial',
    loadChildren: () => import('./pages/tutorial/tutorial.module').then(m => m.TutorialPageModule),
  },
  {
    path: 'politics/:segment',
    loadChildren: () => import('./pages/politics/politics.module').then(m => m.PoliticsPageModule),
  },
  {
    path: 'terms-and-conditions/:segment',
    loadChildren: () => import('./pages/terms-and-conditions/terms-and-conditions.module').then(m => m.TermsAndConditionsPageModule),
  },
  {
    path: 'bulletins',
    loadChildren: () => import('./pages/bulletins/bulletins.module').then(m => m.BulletinsPageModule)
  },
  {
    path: 'wall',
    loadChildren: () => import('./pages/wall/wall.module').then(m => m.WallPageModule)
  },
  {
    path: 'wall/:user_id',
    loadChildren: () => import('./pages/wall/wall.module').then(m => m.WallPageModule)
  },
  {
    path: 'privacy',
    loadChildren: () => import('./pages/user/privacy/privacy.module').then(m => m.PrivacyPageModule)
  },
  {
    path: 'error',
    loadChildren: () => import('./pages/error/error.module').then(m => m.ErrorPageModule)
  },
  {
    path: '**',
    redirectTo: 'error'
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, useHash: true })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
