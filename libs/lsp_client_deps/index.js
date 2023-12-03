import * as VS_Types from 'vscode-languageserver-types';
import {RequestManager, Client, WebSocketTransport} from '@open-rpc/client-js';
export const OpenRPC = {RequestManager, Client, WebSocketTransport};
//Postpone need for babel and reduce bundle size, inline only what we need.
export const VSCodeLSP = Object.assign(
  {
    CompletionTriggerKind: {
      /**
       * Completion was triggered by typing an identifier (24x7 code
       * complete), manual invocation (e.g Ctrl+Space) or via API.
       */
      Invoked: 1,
      /**
       * Completion was triggered by a trigger character specified by
       * the `triggerCharacters` properties of the `CompletionRegistrationOptions`.
       */
      TriggerCharacter: 2,
      /**
       * Completion was re-triggered as current completion list is incomplete
       */
      TriggerForIncompleteCompletions: 3,
    },
    TextDocumentSyncKind: {
      /**
       * Documents should not be synced at all.
       */
      None: 0,
      /**
       * Documents are synced by always sending the full content
       * of the document.
       */
      Full: 1,
      /**
       * Documents are synced by sending the full content on open.
       * After that only incremental updates to the document are
       * send.
       */
      Incremental: 2,
    },
  },
  VS_Types
);
