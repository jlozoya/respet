import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Message } from '@respet/shared';

import { toAttachment, type LocalAttachment, type OutgoingMessage } from '../../core/api/chat.service';
import { VoiceRecorder } from '../../core/media/voice-recorder';
import { FeedbackService } from '../../core/ui/feedback.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';

/** Borradores por conversación, para no perder lo escrito al cambiar de chat. */
const drafts = new Map<string, string>();

/** Adjuntos por mensaje, como admite el servidor. */
const MAX_FILES = 10;

/**
 * La caja de escribir del chat.
 *
 * Texto que crece hasta cinco líneas, adjuntos con vista previa, notas de voz
 * y el pulgar de Messenger cuando no hay nada escrito. Intro envía en el
 * escritorio; Mayús+Intro hace un salto de línea.
 */
@Component({
  selector: 'app-chat-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, DurationPipe, FullNamePipe],
  template: `
    @if (replyTo(); as quoted) {
      <div class="banner">
        <span class="banner-text">
          <span class="rs-strong">{{ 'MESSENGER.REPLYING_TO' | translate: { name: (quoted.sender | fullName) } }}</span>
          <span class="rs-muted rs-ellipsis">{{ quoted.body || ('MESSENGER.ATTACHMENT' | translate) }}</span>
        </span>
        <button type="button" class="rs-icon-btn plain" (click)="cancelReply.emit()" [attr.aria-label]="'CANCEL' | translate">
          <ion-icon name="close" />
        </button>
      </div>
    }

    @if (editing(); as message) {
      <div class="banner">
        <span class="banner-text">
          <span class="rs-strong">{{ 'MESSENGER.EDITING' | translate }}</span>
          <span class="rs-muted rs-ellipsis">{{ message.body }}</span>
        </span>
        <button type="button" class="rs-icon-btn plain" (click)="cancelEdit.emit()" [attr.aria-label]="'CANCEL' | translate">
          <ion-icon name="close" />
        </button>
      </div>
    }

    @if (attachments().length) {
      <div class="previews">
        @for (file of attachments(); track $index) {
          <div class="preview">
            @switch (file.type) {
              @case ('image') {
                <img [src]="file.previewUrl" [alt]="file.name" />
              }
              @case ('video') {
                <video [src]="file.previewUrl" muted></video>
              }
              @default {
                <span class="file"><ion-icon name="document-text" /><span class="rs-ellipsis">{{ file.name }}</span></span>
              }
            }
            <button type="button" class="remove" (click)="removeAttachment($index)" [attr.aria-label]="'REMOVE' | translate">
              <ion-icon name="close" />
            </button>
          </div>
        }
      </div>
    }

    @if (readOnly()) {
      <p class="read-only">{{ 'MESSENGER.READ_ONLY' | translate }}</p>
    } @else if (recorder.recording()) {
      <div class="bar recording">
        <button type="button" class="rs-icon-btn plain danger" (click)="cancelRecording()" [attr.aria-label]="'CANCEL' | translate">
          <ion-icon name="trash-outline" />
        </button>
        <span class="wave"><span class="pulse"></span>{{ recorder.elapsedMs() | duration }}</span>
        <button type="button" class="rs-icon-btn send" (click)="finishRecording()" [attr.aria-label]="'SEND' | translate">
          <ion-icon name="send" />
        </button>
      </div>
    } @else {
      <div class="bar">
        @if (!editing()) {
          <button type="button" class="rs-icon-btn plain accent" (click)="fileInput.click()" [attr.aria-label]="'MESSENGER.ATTACH' | translate">
            <ion-icon name="add-circle" />
          </button>
          <button type="button" class="rs-icon-btn plain accent" (click)="photoInput.click()" [attr.aria-label]="'MESSENGER.PHOTO' | translate">
            <ion-icon name="image" />
          </button>
          @if (canRecord && !hasContent()) {
            <button type="button" class="rs-icon-btn plain accent" (click)="startRecording()" [attr.aria-label]="'MESSENGER.VOICE' | translate">
              <ion-icon name="mic" />
            </button>
          }
        }

        <label class="field">
          <textarea
            #textarea
            rows="1"
            maxlength="4000"
            [value]="text()"
            [placeholder]="'MESSENGER.PLACEHOLDER' | translate"
            (input)="onInput($any($event.target).value)"
            (keydown.enter)="onEnter($any($event))"
            (paste)="onPaste($event)"
          ></textarea>
        </label>

        @if (hasContent() || editing()) {
          <button type="button" class="rs-icon-btn plain accent" (click)="submit()" [attr.aria-label]="'SEND' | translate">
            <ion-icon name="send" />
          </button>
        } @else {
          <button type="button" class="rs-icon-btn plain like" (click)="sendLike()" [attr.aria-label]="'MESSENGER.LIKE' | translate">
            👍
          </button>
        }
      </div>
    }

    <input #fileInput type="file" multiple hidden (change)="onFiles($event)" />
    <input #photoInput type="file" multiple hidden accept="image/*,video/*" (change)="onFiles($event)" />
  `,
  styleUrl: './chat-composer.component.scss',
})
export class ChatComposerComponent implements OnDestroy {
  private readonly feedback = inject(FeedbackService);

  readonly conversationId = input.required<string>();
  readonly readOnly = input(false);
  readonly replyTo = input<Message | null>(null);
  readonly editing = input<Message | null>(null);

  readonly send = output<OutgoingMessage>();
  readonly edit = output<string>();
  readonly typing = output<void>();
  readonly cancelReply = output<void>();
  readonly cancelEdit = output<void>();

  readonly text = signal('');
  readonly attachments = signal<LocalAttachment[]>([]);
  readonly recorder = new VoiceRecorder();
  readonly canRecord = VoiceRecorder.supported;

  readonly hasContent = computed(() => this.text().trim().length > 0 || this.attachments().length > 0);

  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  constructor() {
    // Cada conversación recupera su borrador.
    effect(() => {
      this.text.set(drafts.get(this.conversationId()) ?? '');
      queueMicrotask(() => this.resize());
    });

    // Al empezar a editar se carga el texto del mensaje.
    effect(() => {
      const message = this.editing();

      if (message) {
        this.text.set(message.body ?? '');
        queueMicrotask(() => {
          this.resize();
          this.focus();
        });
      }
    });

    effect(() => {
      if (this.replyTo()) {
        queueMicrotask(() => this.focus());
      }
    });
  }

  ngOnDestroy(): void {
    this.recorder.cancel();

    for (const file of this.attachments()) {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    }
  }

  focus(): void {
    this.textarea()?.nativeElement.focus();
  }

  onInput(value: string): void {
    this.text.set(value);
    drafts.set(this.conversationId(), value);
    this.resize();

    if (value.trim()) {
      this.typing.emit();
    }
  }

  onEnter(event: KeyboardEvent): void {
    // En el móvil Intro es salto de línea: el teclado ya tiene su botón de enviar.
    const touch = window.matchMedia('(hover: none)').matches;

    if (event.shiftKey || touch || event.isComposing) {
      return;
    }

    event.preventDefault();
    this.submit();
  }

  onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []);

    if (files.length) {
      event.preventDefault();
      this.addFiles(files);
    }
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  removeAttachment(index: number): void {
    this.attachments.update((current) => {
      const removed = current[index];

      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((_, position) => position !== index);
    });
  }

  submit(): void {
    const body = this.text().trim();

    if (this.editing()) {
      if (body) {
        this.edit.emit(body);
        this.clear();
      }

      return;
    }

    if (!this.hasContent()) {
      return;
    }

    this.send.emit({ body, files: this.attachments(), replyTo: this.replyTo() });
    // Las vistas previas pasan al mensaje optimista, que las libera al enviarse.
    this.attachments.set([]);
    this.clear();
  }

  sendLike(): void {
    this.send.emit({ body: '👍', replyTo: this.replyTo() });
  }

  async startRecording(): Promise<void> {
    try {
      await this.recorder.start();
    } catch {
      await this.feedback.toast('MESSENGER.MIC_DENIED', { color: 'danger' });
    }
  }

  cancelRecording(): void {
    this.recorder.cancel();
  }

  async finishRecording(): Promise<void> {
    const note = await this.recorder.stop();

    if (!note) {
      return;
    }

    const extension = note.mimeType.includes('mp4') ? 'm4a' : note.mimeType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([note.blob], `nota-de-voz.${extension}`, { type: note.blob.type });

    this.send.emit({ files: [toAttachment(file)], durationMs: note.durationMs, replyTo: this.replyTo() });
  }

  private addFiles(files: File[]): void {
    const room = MAX_FILES - this.attachments().length;

    if (files.length > room) {
      void this.feedback.toast('MESSENGER.TOO_MANY_FILES');
    }

    this.attachments.update((current) => [...current, ...files.slice(0, room).map((file) => toAttachment(file))]);
  }

  private clear(): void {
    this.text.set('');
    drafts.delete(this.conversationId());
    queueMicrotask(() => this.resize());
  }

  private resize(): void {
    const element = this.textarea()?.nativeElement;

    if (!element) {
      return;
    }

    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  }
}
