import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import * as chat from './schemas/chat.schema.js';
import * as content from './schemas/content.schema.js';
import * as developer from './schemas/developer.schema.js';
import * as notification from './schemas/notification.schema.js';
import * as store from './schemas/store.schema.js';
import * as story from './schemas/story.schema.js';
import * as user from './schemas/user.schema.js';

/**
 * Conexión a MongoDB y registro de todos los modelos.
 *
 * Sustituye a `PrismaModule`. Los modelos se registran en un módulo global —y
 * no en el de cada dominio— porque los servicios se cruzan constantemente: el
 * muro necesita usuarios y archivos, el chat necesita usuarios, y la tienda
 * necesita ubicaciones. Repartirlos obligaría a reexportarlos en cadena.
 */
const modelos = [
  { name: user.User.name, schema: user.UserSchema },
  { name: user.UserPermissions.name, schema: user.UserPermissionsSchema },
  { name: user.UserEmail.name, schema: user.UserEmailSchema },
  { name: user.UserPhone.name, schema: user.UserPhoneSchema },
  { name: user.SocialLink.name, schema: user.SocialLinkSchema },
  { name: user.Session.name, schema: user.SessionSchema },
  { name: user.MfaFactor.name, schema: user.MfaFactorSchema },
  { name: user.MfaChallenge.name, schema: user.MfaChallengeSchema },
  { name: user.TrustedDevice.name, schema: user.TrustedDeviceSchema },
  { name: user.AuthThrottle.name, schema: user.AuthThrottleSchema },
  { name: user.SecurityEvent.name, schema: user.SecurityEventSchema },
  { name: user.Block.name, schema: user.BlockSchema },
  { name: user.RefreshToken.name, schema: user.RefreshTokenSchema },
  { name: user.PasswordReset.name, schema: user.PasswordResetSchema },
  { name: user.EmailVerification.name, schema: user.EmailVerificationSchema },

  { name: content.Location.name, schema: content.LocationSchema },
  { name: content.Media.name, schema: content.MediaSchema },
  { name: content.Post.name, schema: content.PostSchema },
  { name: content.PostReaction.name, schema: content.PostReactionSchema },
  { name: content.PostVote.name, schema: content.PostVoteSchema },
  { name: content.Comment.name, schema: content.CommentSchema },
  { name: content.CommentLike.name, schema: content.CommentLikeSchema },
  { name: content.SavedPost.name, schema: content.SavedPostSchema },
  { name: content.Hashtag.name, schema: content.HashtagSchema },
  { name: content.Follow.name, schema: content.FollowSchema },
  { name: content.PostReport.name, schema: content.PostReportSchema },
  { name: content.Report.name, schema: content.ReportSchema },
  { name: content.Bulletin.name, schema: content.BulletinSchema },
  { name: content.SupportTicket.name, schema: content.SupportTicketSchema },

  { name: story.Story.name, schema: story.StorySchema },
  { name: story.StoryView.name, schema: story.StoryViewSchema },
  { name: story.StoryHighlight.name, schema: story.StoryHighlightSchema },
  { name: story.LiveStream.name, schema: story.LiveStreamSchema },
  { name: story.LiveComment.name, schema: story.LiveCommentSchema },

  { name: notification.Notification.name, schema: notification.NotificationSchema },
  { name: notification.PushDevice.name, schema: notification.PushDeviceSchema },

  { name: developer.OAuthApp.name, schema: developer.OAuthAppSchema },
  { name: developer.OAuthAuthorizationCode.name, schema: developer.OAuthAuthorizationCodeSchema },
  { name: developer.OAuthGrant.name, schema: developer.OAuthGrantSchema },
  { name: developer.OAuthRefreshToken.name, schema: developer.OAuthRefreshTokenSchema },
  { name: developer.WebhookDelivery.name, schema: developer.WebhookDeliverySchema },
  { name: developer.ApiUsage.name, schema: developer.ApiUsageSchema },

  { name: store.Warehouse.name, schema: store.WarehouseSchema },
  { name: store.Product.name, schema: store.ProductSchema },
  { name: store.Order.name, schema: store.OrderSchema },
  { name: store.OrderItem.name, schema: store.OrderItemSchema },
  { name: store.Payment.name, schema: store.PaymentSchema },

  { name: chat.Conversation.name, schema: chat.ConversationSchema },
  { name: chat.ConversationMember.name, schema: chat.ConversationMemberSchema },
  { name: chat.Message.name, schema: chat.MessageSchema },
];

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('database.url'),
        maxPoolSize: config.getOrThrow<number>('database.poolSize'),
        // La base va en «replica set» de un solo nodo porque Mongo sólo ofrece
        // transacciones así, y el inventario y los pedidos las necesitan.
        retryWrites: true,
      }),
    }),
    MongooseModule.forFeature(modelos),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
