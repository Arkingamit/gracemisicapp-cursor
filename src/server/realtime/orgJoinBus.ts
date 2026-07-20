import { EventEmitter } from 'events';
import type { JoinRequest } from '@/lib/types';

export type OrgJoinRealtimeEvent =
  | { type: 'join_request'; request: JoinRequest }
  | { type: 'join_request_removed'; requestId: string }
  | { type: 'refresh' };

type OrgJoinBus = EventEmitter & {
  publish: (organizationId: string, event: OrgJoinRealtimeEvent) => void;
  subscribe: (
    organizationId: string,
    listener: (event: OrgJoinRealtimeEvent) => void
  ) => () => void;
};

const globalWithBus = globalThis as typeof globalThis & {
  __orgJoinBus?: OrgJoinBus;
};

function channel(organizationId: string) {
  return `org-join:${organizationId}`;
}

function createBus(): OrgJoinBus {
  const emitter = new EventEmitter() as OrgJoinBus;
  emitter.setMaxListeners(100);

  emitter.publish = (organizationId, event) => {
    emitter.emit(channel(organizationId), event);
  };

  emitter.subscribe = (organizationId, listener) => {
    const key = channel(organizationId);
    emitter.on(key, listener);
    return () => emitter.off(key, listener);
  };

  return emitter;
}

/** Process-local pub/sub for org join-request realtime updates */
export const orgJoinBus: OrgJoinBus =
  globalWithBus.__orgJoinBus ?? (globalWithBus.__orgJoinBus = createBus());

export function publishOrgJoinEvent(
  organizationId: string,
  event: OrgJoinRealtimeEvent
) {
  orgJoinBus.publish(organizationId, event);
}
