import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonDatetime } from '@ionic/angular/ion-datetime';
import { IonDatetimeButton } from '@ionic/angular/ion-datetime-button';
import { IonModal } from '@ionic/angular/ion-modal';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { TranslatePipe } from '@ngx-translate/core';
import { Gender, type LocationInput, type User } from '@respet/shared';

import { UsersService } from '../../../../core/api/users.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { FeedbackService } from '../../../../core/ui/feedback.service';
import { LocationPickerComponent } from '../../../../components/location-picker/location-picker.component';
import { ControlMessagesComponent } from '../../../../shared/components/control-messages.component';
import { phoneValidator, usernameValidator } from '../../../../shared/validators/form-validators';

/**
 * Datos del perfil y dirección.
 *
 * El correo y la contraseña viven en `app-access`, por encima de esto:
 * cambiarlos no se guarda con este botón —el correo hay que confirmarlo desde
 * un enlace— y es lo que más se viene a tocar, mientras que el nombre y la
 * fecha de nacimiento se rellenan una vez.
 *
 * El idioma se fue a la pantalla de configuración, que es donde está también
 * el tema: aquí era un segundo mando para lo mismo, y sólo uno de los dos
 * llegaba al servidor.
 */
@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ControlMessagesComponent,
    LocationPickerComponent,
    IonList,
    IonItem,
    IonInput,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonButton,
  ],
})
export class UserFormComponent {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly user = input.required<User>();
  /** Falso cuando un administrador edita la ficha de otra persona. */
  readonly isSelf = input(true);

  readonly saved = output<User>();

  readonly saving = signal(false);
  readonly location = signal<LocationInput | null>(null);

  /** Tope de la rueda: nadie ha nacido mañana. */
  readonly today = new Date().toISOString().slice(0, 10);

  readonly genders = [
    { value: Gender.Female, label: 'FEMALE' },
    { value: Gender.Male, label: 'MALE' },
    // El tercer valor del enumerado sigue siendo `other`; lo que cambia es
    // cómo se ofrece: quien no se reconoce en los dos primeros no tiene por
    // qué declararse «otro».
    { value: Gender.Unspecified, label: 'PREFER_NOT_TO_SAY' },
  ];

  private readonly builder = inject(FormBuilder);

  readonly form = this.builder.nonNullable.group({
    name: ['', [Validators.required, usernameValidator()]],
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    gender: [null as Gender | null],
    phone: ['', [phoneValidator()]],
    birthday: [null as string | null],
  });

  constructor() {
    // Los `input.required` no tienen valor al construir el componente; el
    // efecto además vuelve a rellenar el formulario si cambia el usuario.
    effect(() => {
      const current = this.user();

      this.form.patchValue({
        name: current.name,
        firstName: current.firstName,
        lastName: current.lastName,
        gender: current.gender,
        phone: current.phone ?? '',
        birthday: current.birthday,
      });

      if (current.location) {
        const { id: _id, ...rest } = current.location;
        this.location.set(rest);
      } else {
        this.location.set(null);
      }
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);

    try {
      const values = this.form.getRawValue();
      const current = this.user();
      const profile = {
        name: values.name,
        firstName: values.firstName,
        lastName: values.lastName,
        gender: values.gender,
        phone: values.phone || null,
        birthday: values.birthday ? values.birthday.slice(0, 10) : null,
      };

      let updated = this.isSelf()
        ? await this.users.updateProfile(profile)
        : await this.users.updateProfileById(current.id, profile);

      updated = this.isSelf()
        ? await this.users.updateLocation({ location: this.location() })
        : await this.users.updateLocationById(current.id, { location: this.location() });

      if (this.isSelf()) {
        await this.auth.setUser(updated);
      }

      this.saved.emit(updated);
      await this.feedback.success();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.saving.set(false);
    }
  }

}
