import type { MetaFunction } from 'react-router';
import type { ClientDeploymentConfig } from '@curvenote/scms-core';
import Layout from '../_auth/route';

export const meta: MetaFunction = ({ matches }) => {
  const { data } = matches.find(({ id }) => id === 'root') as {
    data: { clientSideConfig: ClientDeploymentConfig };
  };
  const { branding } = data.clientSideConfig;
  return [
    { title: branding?.title ?? 'Curvenote' },
    {
      name: 'description',
      content: branding?.description ?? `Welcome to ${branding?.title ?? 'Curvenote'}.`,
    },
  ];
};

export default function layout() {
  return <Layout />;
}
