import { Injectable, inject } from '@angular/core';
import type {
  Analytics,
  AnalyticsQuery,
  Bulletin,
  CreateBulletinRequest,
  CreateSupportRequest,
  Paginated,
  Report,
  ReportStatus,
  SupportTicket,
  UpdateBulletinRequest,
  UsersRegistrationPoint,
} from '@social-network/shared';

import {
  BULLETIN_FRAGMENTS,
  PAGE_META_FRAGMENTS,
  SUPPORT_TICKET_FRAGMENTS,
  USER_SUMMARY_FRAGMENTS,
  gql,
} from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const BULLETINS = gql(
  `query Bulletins($query: BulletinListQueryInput) {
    bulletins(query: $query) {
      data { ...BulletinFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...BULLETIN_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const BULLETIN = gql(
  `query BulletinById($id: ID!) {
    bulletin(id: $id) { ...BulletinFields }
  }`,
  ...BULLETIN_FRAGMENTS,
);

const CREATE_BULLETIN = gql(
  `mutation CreateBulletin($input: CreateBulletinInput!) {
    createBulletin(input: $input) { ...BulletinFields }
  }`,
  ...BULLETIN_FRAGMENTS,
);

const UPDATE_BULLETIN = gql(
  `mutation UpdateBulletin($id: ID!, $input: UpdateBulletinInput!) {
    updateBulletin(id: $id, input: $input) { ...BulletinFields }
  }`,
  ...BULLETIN_FRAGMENTS,
);

const DELETE_BULLETIN = `mutation DeleteBulletin($id: ID!) { deleteBulletin(id: $id) }`;

const SET_BULLETIN_IMAGE = gql(
  `mutation SetBulletinImage($id: ID!, $file: Upload!) {
    setBulletinImage(id: $id, file: $file) { ...BulletinFields }
  }`,
  ...BULLETIN_FRAGMENTS,
);

/** Avisos publicados por la administración. */
@Injectable({ providedIn: 'root' })
export class BulletinsService {
  private readonly gql = inject(GraphqlClientService);

  async list(
    query: { page?: number; perPage?: number; search?: string } = {},
  ): Promise<Paginated<Bulletin>> {
    const { bulletins } = await this.gql.request<{ bulletins: Paginated<Bulletin> }>(BULLETINS, {
      query,
    });

    return bulletins;
  }

  async findById(id: string): Promise<Bulletin> {
    const { bulletin } = await this.gql.request<{ bulletin: Bulletin }>(BULLETIN, { id });

    return bulletin;
  }

  async create(request: CreateBulletinRequest): Promise<Bulletin> {
    const { createBulletin } = await this.gql.request<{ createBulletin: Bulletin }>(
      CREATE_BULLETIN,
      { input: request },
    );

    return createBulletin;
  }

  async update(id: string, request: UpdateBulletinRequest): Promise<Bulletin> {
    const { updateBulletin } = await this.gql.request<{ updateBulletin: Bulletin }>(
      UPDATE_BULLETIN,
      { id, input: request },
    );

    return updateBulletin;
  }

  async setImage(id: string, file: Blob): Promise<Bulletin> {
    const { setBulletinImage } = await this.gql.request<{ setBulletinImage: Bulletin }>(
      SET_BULLETIN_IMAGE,
      { id, file },
    );

    return setBulletinImage;
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_BULLETIN, { id });
  }
}

const CREATE_SUPPORT_TICKET = gql(
  `mutation CreateSupportTicket($input: CreateSupportInput!) {
    createSupportTicket(input: $input) { ...SupportTicketFields }
  }`,
  ...SUPPORT_TICKET_FRAGMENTS,
);

const SUPPORT_TICKETS = gql(
  `query SupportTickets($query: SupportListQueryInput) {
    supportTickets(query: $query) {
      data { ...SupportTicketFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...SUPPORT_TICKET_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

/** Formulario de contacto. */
@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly gql = inject(GraphqlClientService);

  async send(request: CreateSupportRequest): Promise<SupportTicket> {
    const { createSupportTicket } = await this.gql.request<{ createSupportTicket: SupportTicket }>(
      CREATE_SUPPORT_TICKET,
      { input: request },
    );

    return createSupportTicket;
  }

  async list(
    query: { page?: number; perPage?: number; search?: string } = {},
  ): Promise<Paginated<SupportTicket>> {
    const { supportTickets } = await this.gql.request<{ supportTickets: Paginated<SupportTicket> }>(
      SUPPORT_TICKETS,
      { query },
    );

    return supportTickets;
  }
}

const ANALYTICS = `
query AnalyticsSummary {
  analytics {
    usersTotal
    supportTotal
    postsTotal
    ordersTotal
    gender { male female unspecified unknown }
    ages { children teens youngAdults adults unknown }
    providers { password google facebook apple }
  }
}`;

const USERS_REGISTRATION = `
query UsersRegistration($query: AnalyticsQueryInput) {
  usersRegistration(query: $query) { date users }
}`;

/** Cifras del panel de administración. */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly gql = inject(GraphqlClientService);

  async summary(): Promise<Analytics> {
    const { analytics } = await this.gql.request<{ analytics: Analytics }>(ANALYTICS);

    return analytics;
  }

  async usersRegistration(query: AnalyticsQuery = {}): Promise<UsersRegistrationPoint[]> {
    const { usersRegistration } = await this.gql.request<{
      usersRegistration: UsersRegistrationPoint[];
    }>(USERS_REGISTRATION, { query });

    return usersRegistration;
  }
}

const REPORTS = gql(
  `query Reports($status: ReportStatus, $page: Int, $perPage: Int) {
    reports(status: $status, page: $page, perPage: $perPage) {
      data {
        id
        targetType
        targetId
        targetOwner { ...UserSummaryFields }
        reporter { ...UserSummaryFields }
        reason
        status
        createdAt
        reviewedAt
      }
      meta { ...PageMetaFields }
    }
  }`,
  ...USER_SUMMARY_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const RESOLVE_REPORT = `
mutation ResolveReport($id: ID!, $status: ReportStatus!) {
  resolveReport(id: $id, status: $status)
}`;

/** Denuncias pendientes de revisar, para moderación. */
@Injectable({ providedIn: 'root' })
export class ModerationService {
  private readonly gql = inject(GraphqlClientService);

  async reports(
    query: { status?: ReportStatus; page?: number; perPage?: number } = {},
  ): Promise<Paginated<Report>> {
    const { reports } = await this.gql.request<{ reports: Paginated<Report> }>(REPORTS, query);

    return reports;
  }

  /** Resuelve la denuncia y todas las iguales sobre lo mismo. */
  async resolve(id: string, status: ReportStatus): Promise<void> {
    await this.gql.request(RESOLVE_REPORT, { id, status });
  }
}
