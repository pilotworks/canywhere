import { Type, type Static } from "@sinclair/typebox";

export const RpcIdSchema = Type.Union([Type.String(), Type.Integer()], {
  $id: "RpcId",
});
export type RpcId = Static<typeof RpcIdSchema>;

export const RpcErrorDataSchema = Type.Object(
  {
    code: Type.Integer(),
    message: Type.String(),
    data: Type.Optional(Type.Unknown()),
  },
  { $id: "RpcErrorData" }
);
export type RpcErrorData = Static<typeof RpcErrorDataSchema>;

export const RpcRequestEnvelopeSchema = Type.Object(
  {
    id: RpcIdSchema,
    method: Type.String(),
    params: Type.Optional(Type.Unknown()),
  },
  { $id: "RpcRequestEnvelope" }
);
export type RpcRequestEnvelope = Static<typeof RpcRequestEnvelopeSchema>;

export const RpcResponseEnvelopeSchema = Type.Object(
  {
    id: RpcIdSchema,
    result: Type.Optional(Type.Unknown()),
    error: Type.Optional(RpcErrorDataSchema),
  },
  { $id: "RpcResponseEnvelope" }
);
export type RpcResponseEnvelope = Static<typeof RpcResponseEnvelopeSchema>;

export const RpcNotificationEnvelopeSchema = Type.Object(
  {
    method: Type.String(),
    params: Type.Optional(Type.Unknown()),
  },
  { $id: "RpcNotificationEnvelope" }
);
export type RpcNotificationEnvelope = Static<
  typeof RpcNotificationEnvelopeSchema
>;

export const RpcMessageEnvelopeSchema = Type.Union(
  [
    RpcRequestEnvelopeSchema,
    RpcResponseEnvelopeSchema,
    RpcNotificationEnvelopeSchema,
  ],
  { $id: "RpcMessageEnvelope" }
);
export type RpcMessageEnvelope = Static<typeof RpcMessageEnvelopeSchema>;
