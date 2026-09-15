import { Injectable } from '@nestjs/common';
import type { Analytics, UsersRegistrationPoint } from '@respet/shared';

import { InjectModel } from '@nestjs/mongoose';
import type { Model } from '../database/mongoose.js';

import { Post, SupportTicket } from '../database/schemas/content.schema.js';
import { AuthProvider, Gender } from '../database/schemas/enums.js';
import { Order } from '../database/schemas/store.schema.js';
import { User } from '../database/schemas/user.schema.js';
import type { AnalyticsQueryDto, RegistrationInterval } from './dto/analytics.dto.js';

/**
 * Formato de `DATE_FORMAT` de MySQL por cada agrupación.
 *
 * El mapa es la razón por la que el patrón se puede meter en la agregación:
 * el valor nunca procede de la petición, sino de esta tabla, y el DTO ya ha
 * restringido `interval` a una de estas claves.
 */
const INTERVAL_FORMATS: Record<RegistrationInterval, string> = {
  day: '%Y-%m-%d',
  // Mongo nombra el año y la semana ISO con `%G` y `%V`, donde MySQL usaba
  // `%x` y `%v`.
  week: '%G-W%V',
  month: '%Y-%m-01',
  year: '%Y-01-01',
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(SupportTicket.name) private readonly tickets: Model<SupportTicket>,
  ) {}

  async summary(): Promise<Analytics> {
    const now = new Date();
    const birthdayFor = (yearsAgo: number): Date =>
      new Date(now.getFullYear() - yearsAgo, now.getMonth(), now.getDate());

    const [
      usersTotal,
      supportTotal,
      postsTotal,
      ordersTotal,
      male,
      female,
      unspecifiedGender,
      unknownGender,
      children,
      teens,
      youngAdults,
      adults,
      unknownAge,
      password,
      google,
      facebook,
      apple,
    ] = await Promise.all([
      this.users.countDocuments(),
      this.tickets.countDocuments(),
      this.posts.countDocuments(),
      this.orders.countDocuments(),

      this.users.countDocuments({ gender: Gender.Male }),
      this.users.countDocuments({ gender: Gender.Female }),
      this.users.countDocuments({ gender: Gender.Unspecified }),
      this.users.countDocuments({ gender: null }),

      // Los tramos se calculan sobre la fecha de nacimiento: quien nació
      // después de `hoy - 13 años` tiene menos de 13.
      this.users.countDocuments({ birthday: { $gt: birthdayFor(13) } }),
      this.users.countDocuments({
        birthday: { $gt: birthdayFor(18), $lte: birthdayFor(13) },
      }),
      this.users.countDocuments({
        birthday: { $gt: birthdayFor(30), $lte: birthdayFor(18) },
      }),
      this.users.countDocuments({ birthday: { $lte: birthdayFor(30) } }),
      this.users.countDocuments({ birthday: null }),

      this.users.countDocuments({ provider: AuthProvider.Password }),
      this.users.countDocuments({ provider: AuthProvider.Google }),
      this.users.countDocuments({ provider: AuthProvider.Facebook }),
      this.users.countDocuments({ provider: AuthProvider.Apple }),
    ]);

    return {
      usersTotal,
      supportTotal,
      postsTotal,
      ordersTotal,
      gender: { male, female, unspecified: unspecifiedGender, unknown: unknownGender },
      ages: { children, teens, youngAdults, adults, unknown: unknownAge },
      providers: { password, google, facebook, apple },
    };
  }

  /** Altas de usuarios agrupadas por intervalo. */
  async usersRegistration(query: AnalyticsQueryDto): Promise<UsersRegistrationPoint[]> {
    const interval = query.interval ?? 'month';
    const format = INTERVAL_FORMATS[interval];
    const from = query.from ? new Date(query.from) : defaultFrom(interval);
    const to = query.to ? new Date(query.to) : new Date();

    // El agrupado por fecha lo hacía `DATE_FORMAT` en SQL; aquí lo hace
    // `$dateToString`, que recibe el mismo patrón traducido al dialecto de
    // Mongo (ver `INTERVAL_FORMATS`).
    const filas = await this.users.aggregate<{ _id: string; users: number }>([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format, date: '$createdAt' } },
          users: { $sum: 1 },
          primera: { $min: '$createdAt' },
        },
      },
      { $sort: { primera: 1 } },
    ]);

    return filas.map((fila) => ({ date: fila._id, users: fila.users }));
  }
}

/** Ventana por defecto: la que da una gráfica legible en cada agrupación. */
function defaultFrom(interval: RegistrationInterval): Date {
  const now = new Date();
  const spans: Record<RegistrationInterval, number> = {
    day: 30,
    week: 7 * 26,
    month: 365 * 2,
    year: 365 * 10,
  };

  return new Date(now.getTime() - spans[interval] * 24 * 60 * 60 * 1000);
}
