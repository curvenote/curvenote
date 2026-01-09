import type { ActionFunctionArgs, LoaderFunction } from 'react-router';
import { data as dataResponse, redirect } from 'react-router';
import { getThemeSession } from '@curvenote/scms-server';
import { isTheme } from '@curvenote/scms-core';

export async function action({ request }: ActionFunctionArgs) {
  const themeSession = await getThemeSession(request);
  const requestText = await request.text();
  const form = new URLSearchParams(requestText);
  const theme = form.get('theme');

  if (!isTheme(theme)) {
    return dataResponse({
      success: false,
      message: `theme value of ${theme} is not a valid theme`,
    });
  }

  themeSession.setTheme(theme);
  return dataResponse(
    { success: true },
    { headers: { 'Set-Cookie': await themeSession.commit() } },
  );
}

export const loader: LoaderFunction = () => redirect('/', { status: 404 });
