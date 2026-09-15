import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonItem } from '@ionic/angular/ion-item';
import { IonList } from '@ionic/angular/ion-list';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { TranslatePipe } from '@ngx-translate/core';

import { UsersService } from '../../../../core/api/users.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { FeedbackService } from '../../../../core/ui/feedback.service';
import { ThemeService, type ThemePreference } from '../../../../core/ui/theme.service';

/** Tema e idioma: lo que cambia cómo se ve la aplicación, no lo que guarda. */
@Component({
  selector: 'app-preferences',
  templateUrl: './preferences.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, IonList, IonItem, IonSelect, IonSelectOption],
})
export class PreferencesComponent {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly feedback = inject(FeedbackService);

  readonly themePreference = this.theme.preference;
  readonly themeOptions = this.theme.options;
  readonly currentLanguage = signal(this.language.current());
  readonly languages = this.language.available;

  async changeTheme(preference: string): Promise<void> {
    await this.theme.use(preference as ThemePreference);
  }

  /**
   * Cambia el idioma de la interfaz y lo guarda en la cuenta.
   *
   * `LanguageService` sólo lo recuerda en el dispositivo; lo que hace que los
   * correos que manda el servidor lleguen en el mismo idioma es guardarlo
   * también en el perfil.
   */
  async changeLanguage(lang: string): Promise<void> {
    const normalizado = this.language.normalize(lang);

    this.currentLanguage.set(normalizado);
    await this.language.use(normalizado);

    try {
      await this.auth.setUser(await this.users.updateLanguage(normalizado));
    } catch (error) {
      // El idioma ya se aplicó y se recordó aquí; que el servidor no se haya
      // enterado no es motivo para deshacerlo delante de quien lo eligió.
      await this.feedback.error(error);
    }
  }
}
