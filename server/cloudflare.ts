import { Context, Data, Effect, Layer, Schema } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/http'

const API = 'https://api.cloudflare.com/client/v4'

export class CloudflareError extends Data.TaggedError('CloudflareError')<{
  readonly operation: string
  readonly detail: string
}> {}

export type CloudflareConfig = Readonly<{
  accountId: string
  zoneId: string
  apiToken: string
  host: string
}>

export class CloudflareSettings extends Context.Service<
  CloudflareSettings,
  CloudflareConfig
>()('rank/CloudflareSettings') {}

const GraphQLResponse = Schema.Struct({
  data: Schema.optional(Schema.NullOr(Schema.Unknown)),
  errors: Schema.optional(
    Schema.NullOr(Schema.Array(Schema.Struct({ message: Schema.String }))),
  ),
})

const RestResponse = Schema.Struct({
  success: Schema.Boolean,
  result: Schema.optional(Schema.Unknown),
  errors: Schema.optional(
    Schema.Array(Schema.Struct({ message: Schema.String })),
  ),
})

type CloudflareApiShape = Readonly<{
  graphql: (
    operation: string,
    query: string,
  ) => Effect.Effect<unknown, CloudflareError>
  rest: (
    operation: string,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ) => Effect.Effect<unknown, CloudflareError>
}>

export class CloudflareApi extends Context.Service<
  CloudflareApi,
  CloudflareApiShape
>()('rank/CloudflareApi') {}

const failWith = (operation: string) => (cause: unknown) =>
  new CloudflareError({
    operation,
    detail: cause instanceof Error ? cause.message : String(cause),
  })

export const CloudflareApiLive = Layer.effect(
  CloudflareApi,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const settings = yield* CloudflareSettings

    const send = (
      operation: string,
      request: HttpClientRequest.HttpClientRequest,
    ) =>
      client
        .execute(
          request.pipe(
            HttpClientRequest.bearerToken(settings.apiToken),
            HttpClientRequest.setHeader('Content-Type', 'application/json'),
          ),
        )
        .pipe(
          Effect.flatMap(response => response.json),
          Effect.mapError(failWith(operation)),
        )

    const graphql = (operation: string, query: string) =>
      send(
        operation,
        HttpClientRequest.post(`${API}/graphql`).pipe(
          HttpClientRequest.bodyJsonUnsafe({ query }),
        ),
      ).pipe(
        Effect.flatMap(json =>
          Schema.decodeUnknownEffect(GraphQLResponse)(json).pipe(
            Effect.mapError(failWith(operation)),
          ),
        ),
        Effect.flatMap(({ data, errors }) => {
          const firstError = errors?.[0]
          return firstError
            ? Effect.fail(
                new CloudflareError({ operation, detail: firstError.message }),
              )
            : Effect.succeed(data)
        }),
      )

    const rest = (
      operation: string,
      method: 'GET' | 'POST',
      path: string,
      body?: unknown,
    ) => {
      const url = `${API}${path}`
      const base =
        method === 'GET'
          ? HttpClientRequest.get(url)
          : HttpClientRequest.post(url).pipe(
              HttpClientRequest.bodyJsonUnsafe(body ?? {}),
            )
      return send(operation, base).pipe(
        Effect.flatMap(json =>
          Schema.decodeUnknownEffect(RestResponse)(json).pipe(
            Effect.mapError(failWith(operation)),
          ),
        ),
        Effect.flatMap(({ success, result, errors }) =>
          success
            ? Effect.succeed(result)
            : Effect.fail(
                new CloudflareError({
                  operation,
                  detail: errors?.[0]?.message ?? 'request failed',
                }),
              ),
        ),
      )
    }

    return { graphql, rest }
  }),
)
