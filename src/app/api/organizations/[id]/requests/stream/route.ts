import { NextRequest } from 'next/server';
import { OrganizationModel } from '@/server/models/organization';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import {
  orgJoinBus,
  type OrgJoinRealtimeEvent,
} from '@/server/realtime/orgJoinBus';
import type { JoinRequest } from '@/lib/types';
import type { ChangeStream, Document } from 'mongodb';
import { z } from 'zod';
import { validateParams } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function mapJoinRequest(doc: Document): JoinRequest {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId,
    userId: doc.userId,
    userEmail: doc.userEmail,
    userName: doc.userName,
    status: doc.status,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : String(doc.createdAt),
  };
}

function toSseChunk(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Live push stream for pending join requests.
 * Uses Server-Sent Events (Vercel/Next.js compatible) + Mongo change streams
 * and an in-process bus so managers get updates without polling.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthUser(request);
  if (!auth) return authError('Not authenticated');

  const parsedParams = validateParams(await params, idParamsSchema);
  if (!parsedParams.ok) return parsedParams.response;
  const { id } = parsedParams.data;
  const org = await OrganizationModel.findById(id);
  if (!org) return Response.json({ error: 'Organization not found' }, { status: 404 });

  if (auth.role !== 'super_admin' && !org.managerIds.includes(auth.userId)) {
    return Response.json(
      { error: 'Not authorized to view requests for this organization' },
      { status: 403 }
    );
  }

  let changeStream: ChangeStream | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribeBus: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: OrgJoinRealtimeEvent | { type: 'connected' }) => {
        if (closed) return;
        try {
          controller.enqueue(toSseChunk(event));
        } catch {
          // stream already closed
        }
      };

      const cleanup = async () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        unsubscribeBus?.();
        unsubscribeBus = null;
        if (changeStream) {
          try {
            await changeStream.close();
          } catch {
            /* ignore */
          }
          changeStream = null;
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      send({ type: 'connected' });

      unsubscribeBus = orgJoinBus.subscribe(id, (event) => send(event));

      // MongoDB change streams work across serverless instances (Atlas replica set)
      try {
        const collection = await getCollection(COLLECTIONS.JOIN_REQUESTS);
        changeStream = collection.watch(
          [
            {
              $match: {
                'fullDocument.organizationId': id,
                operationType: { $in: ['insert', 'update', 'replace'] },
              },
            },
          ],
          { fullDocument: 'updateLookup' }
        );

        changeStream.on('change', (change) => {
          const doc = change.fullDocument;
          if (!doc) {
            send({ type: 'refresh' });
            return;
          }
          const requestDoc = mapJoinRequest(doc);
          if (requestDoc.status === 'pending') {
            send({ type: 'join_request', request: requestDoc });
          } else {
            send({ type: 'join_request_removed', requestId: requestDoc.id });
          }
        });

        changeStream.on('error', (err) => {
          console.error('Join request change stream error:', err);
          send({ type: 'refresh' });
        });
      } catch (err) {
        console.warn(
          'Join request change stream unavailable; using in-process bus only:',
          err
        );
      }

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        } catch {
          void cleanup();
        }
      }, 20000);

      request.signal.addEventListener('abort', () => {
        void cleanup();
      });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribeBus?.();
      void changeStream?.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
