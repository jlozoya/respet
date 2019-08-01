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
    loadChildren: './pages/main/main.module#MainPageModule',
  },
  {
    path: 'account',
    canActivate: [SesionGuard],
    loadChildren: './pages/user/account/account.module#AccountPageModule',
  },
  {
    path: 'account/:user_id',
    canActivate: [SesionGuard, AdminGuard],
    loadChildren: './pages/user/account/account.module#AccountPageModule',
  },
  {
    path: 'about',
    loadChildren: './pages/about/about.module#AboutPageModule',
  },
  {
    path: 'login',
    loadChildren: './pages/login/login.module#LoginPageModule',
  },
  {
    path: 'login/:token',
    loadChildren: './pages/login/login.module#LoginPageModule',
  },
  {
    path: 'signup',
    loadChildren: './pages/signup/signup.module#SignupPageModule',
  },
  {
    path: 'signup/:token',
    loadChildren: './pages/signup/signup.module#SignupPageModule',
  },
  {
    path: 'analytics',
    canActivate: [SesionGuard, AdminGuard],
    loadChildren: './pages/admin/analytics/analytics.module#AnalyticsPageModule',
  },
  {
    path: 'users',
    canActivate: [SesionGuard, AdminGuard],
    loadChildren: './pages/admin/users/users.module#UsersPageModule',
  },
  {
    path: 'tutorial',
    loadChildren: './pages/tutorial/tutorial.module#TutorialPageModule',
  },
  {
    path: 'politics/:segment',
    loadChildren: './pages/politics/politics.module#PoliticsPageModule',
  },
  {
    path: 'terms-and-conditions/:segment',
    loadChildren: './pages/terms-and-conditions/terms-and-conditions.module#TermsAndConditionsPageModule',
  },
  {
    path: 'bulletins',
    loadChildren: './pages/bulletins/bulletins.module#BulletinsPageModule'
  },
  {
    path: 'wall',
    loadChildren: './pages/wall/wall.module#WallPageModule'
  },
  {
    path: 'wall/:user_id',
    loadChildren: './pages/wall/wall.module#WallPageModule'
  },
  {
    path: 'privacy',
    loadChildren: './pages/user/privacy/privacy.module#PrivacyPageModule'
  },
  {
    path: 'error',
    loadChildren: './pages/error/error.module#ErrorPageModule'
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
