import { Injectable } from '@angular/core';
import { Subject, Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Events {
  private readonly channels = new Map<string, Subject<unknown[]>>();

  publish(topic: string, ...args: unknown[]): void {
    this.channel(topic).next(args);
  }

  subscribe(topic: string, handler: (...args: any[]) => void): Subscription {
    return this.channel(topic).subscribe(args => handler(...args));
  }

  private channel(topic: string): Subject<unknown[]> {
    if (!this.channels.has(topic)) {
      this.channels.set(topic, new Subject<unknown[]>());
    }
    return this.channels.get(topic)!;
  }
}
