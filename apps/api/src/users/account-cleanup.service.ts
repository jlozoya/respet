import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import type { Model } from '../database/mongoose.js';
import { ConversationMember } from '../database/schemas/chat.schema.js';
import {
  Comment,
  CommentLike,
  Follow,
  Media as MediaDoc,
  Post,
  PostReaction,
  PostVote,
  Report,
  SavedPost,
} from '../database/schemas/content.schema.js';
import { OAuthApp, OAuthGrant } from '../database/schemas/developer.schema.js';
import { Notification, PushDevice } from '../database/schemas/notification.schema.js';
import { LiveStream, Story, StoryHighlight, StoryView } from '../database/schemas/story.schema.js';
import {
  Block,
  MfaFactor,
  SecurityEvent,
  SocialLink,
  TrustedDevice,
  User as UserDoc,
  UserEmail,
  UserPermissions,
  UserPhone,
} from '../database/schemas/user.schema.js';
import { MediaService } from '../media/media.service.js';

/**
 * El borrado de una cuenta, colección por colección.
 *
 * En SQL lo hacían las claves foráneas en cascada; aquí no hay quien lo haga,
 * así que se enumera todo lo que cuelga de una persona. Olvidar una colección
 * no da error: deja basura apuntando a una cuenta que ya no existe. Por eso
 * vive aparte y se lee de un tirón.
 *
 * Sus mensajes en conversaciones ajenas se quedan —sin nombre, como «usuario
 * de Respet»— para no dejar huecos en el hilo de los demás, igual que hace
 * cualquier aplicación de mensajería.
 */
@Injectable()
export class AccountCleanup {
  constructor(
    @InjectModel(UserDoc.name) private readonly users: Model<UserDoc>,
    @InjectModel(UserPermissions.name) private readonly permissions: Model<UserPermissions>,
    @InjectModel(UserEmail.name) private readonly emails: Model<UserEmail>,
    @InjectModel(UserPhone.name) private readonly phones: Model<UserPhone>,
    @InjectModel(SocialLink.name) private readonly socialLinks: Model<SocialLink>,
    @InjectModel(Follow.name) private readonly follows: Model<Follow>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(PostReaction.name) private readonly reactions: Model<PostReaction>,
    @InjectModel(PostVote.name) private readonly votes: Model<PostVote>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(CommentLike.name) private readonly commentLikes: Model<CommentLike>,
    @InjectModel(SavedPost.name) private readonly saved: Model<SavedPost>,
    @InjectModel(Report.name) private readonly reports: Model<Report>,
    @InjectModel(MediaDoc.name) private readonly mediaModel: Model<MediaDoc>,
    @InjectModel(Story.name) private readonly stories: Model<Story>,
    @InjectModel(StoryView.name) private readonly storyViews: Model<StoryView>,
    @InjectModel(StoryHighlight.name) private readonly highlights: Model<StoryHighlight>,
    @InjectModel(LiveStream.name) private readonly lives: Model<LiveStream>,
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    @InjectModel(PushDevice.name) private readonly pushDevices: Model<PushDevice>,
    @InjectModel(ConversationMember.name) private readonly members: Model<ConversationMember>,
    @InjectModel(Block.name) private readonly blocks: Model<Block>,
    @InjectModel(MfaFactor.name) private readonly mfa: Model<MfaFactor>,
    @InjectModel(TrustedDevice.name) private readonly trustedDevices: Model<TrustedDevice>,
    @InjectModel(SecurityEvent.name) private readonly securityEvents: Model<SecurityEvent>,
    @InjectModel(OAuthGrant.name) private readonly grants: Model<OAuthGrant>,
    @InjectModel(OAuthApp.name) private readonly apps: Model<OAuthApp>,
    private readonly media: MediaService,
  ) {}

  async purge(id: string): Promise<void> {
    const [posts, stories, user] = await Promise.all([
      this.posts.find({ userId: id }).select('_id').lean(),
      this.stories.find({ authorId: id }).select('_id mediaId').lean(),
      this.users.findById(id).select('avatarId coverId').lean(),
    ]);
    const postIds = posts.map((post) => post._id);
    const storyIds = stories.map((story) => story._id);

    const postMedia = await this.mediaModel.find({ postId: { $in: postIds } }).select('_id').lean();
    const commentIds = (await this.comments.find({ userId: id }).select('_id').lean()).map((doc) => doc._id);

    const mediaIds = [
      ...(user?.avatarId ? [user.avatarId] : []),
      ...(user?.coverId ? [user.coverId] : []),
      ...postMedia.map((doc) => doc._id),
      ...stories.flatMap((story) => (story.mediaId ? [story.mediaId] : [])),
    ];

    await Promise.all([
      // Lo que colgaba de sus publicaciones e historias.
      this.reactions.deleteMany({ postId: { $in: postIds } }),
      this.votes.deleteMany({ postId: { $in: postIds } }),
      this.comments.deleteMany({ postId: { $in: postIds } }),
      this.saved.deleteMany({ postId: { $in: postIds } }),
      this.storyViews.deleteMany({ storyId: { $in: storyIds } }),
      // Lo que dejó en lo de otros.
      this.reactions.deleteMany({ userId: id }),
      this.votes.deleteMany({ userId: id }),
      this.comments.deleteMany({ userId: id }),
      this.commentLikes.deleteMany({ $or: [{ userId: id }, { commentId: { $in: commentIds } }] }),
      this.saved.deleteMany({ userId: id }),
      this.storyViews.deleteMany({ viewerId: id }),
      this.reports.deleteMany({ reporterId: id }),
      this.notifications.deleteMany({ $or: [{ recipientId: id }, { actorIds: [id] }] }),
      this.notifications.updateMany({ actorIds: id }, { $pull: { actorIds: id }, $inc: { actorCount: -1 } }),
      // Las relaciones van en los dos sentidos.
      this.follows.deleteMany({ $or: [{ followerId: id }, { followeeId: id }] }),
      this.blocks.deleteMany({ $or: [{ blockerId: id }, { blockedId: id }] }),
      // Sale de todas sus conversaciones.
      this.members.updateMany({ userId: id, leftAt: null }, { $set: { leftAt: new Date() } }),
      // Y sus cosas.
      this.posts.deleteMany({ userId: id }),
      // Las publicaciones que compartían las suyas dejan de apuntar a nada.
      this.posts.updateMany({ sharedPostId: { $in: postIds } }, { $set: { sharedPostId: null } }),
      this.stories.deleteMany({ authorId: id }),
      this.highlights.deleteMany({ userId: id }),
      this.lives.deleteMany({ hostId: id }),
      this.emails.deleteMany({ userId: id }),
      this.phones.deleteMany({ userId: id }),
      this.socialLinks.deleteMany({ userId: id }),
      this.permissions.deleteMany({ userId: id }),
      this.pushDevices.deleteMany({ userId: id }),
      this.mfa.deleteMany({ userId: id }),
      this.trustedDevices.deleteMany({ userId: id }),
      this.securityEvents.deleteMany({ userId: id }),
      this.grants.deleteMany({ userId: id }),
      this.apps.deleteMany({ ownerId: id }),
    ]);

    await this.users.deleteOne({ _id: id });
    await this.media.removeMany(mediaIds);
  }
}
