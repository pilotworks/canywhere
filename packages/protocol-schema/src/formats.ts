import { FormatRegistry } from "@sinclair/typebox";

// Standard UUID format validator (8-4-4-4-12 hex characters)
if (!FormatRegistry.Has("uuid")) {
  FormatRegistry.Set(
    "uuid",
    (value) =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}
