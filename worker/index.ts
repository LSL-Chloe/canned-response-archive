/**
 * The initial Worker has no database credentials, login logic, or write routes.
 * Future API handlers must authenticate and authorize access server-side.
 */
export default {
  fetch(request: Request): Response {
    const path = new URL(request.url).pathname;

    if (request.method === 'GET' && path === '/api/health') {
      return Response.json(
        { status: 'ok', service: 'canned-response-archive', phase: 'foundation' },
        { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
      );
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  },
} satisfies ExportedHandler;
