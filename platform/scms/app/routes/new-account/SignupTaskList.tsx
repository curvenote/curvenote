import type { ClientSignupConfig } from '@curvenote/scms-core';
import { AgreementStep } from './AgreementStep';
import { LinkProvidersStep } from './LinkProviders';
import { DataCollectionStep } from './DataCollection';
import { PrimaryProviderStep } from './PrimaryProviderStep';

export function SignupTaskList({
  config,
  primaryProvider,
  openTaskName,
  setOpenTaskName,
}: {
  config: ClientSignupConfig;
  primaryProvider?: string;
  openTaskName: string | undefined;
  setOpenTaskName: (taskName: string) => void;
}) {
  const steps = config.steps
    ?.map((step) => {
      switch (step.type) {
        case 'link-providers': {
          return (
            <LinkProvidersStep
              key={step.type}
              title={step.title}
              providers={step.providers ?? []}
              open={openTaskName === step.type}
              setOpen={(b) => (b ? setOpenTaskName(step.type) : setOpenTaskName(''))}
            />
          );
        }
        case 'data-collection': {
          return (
            <DataCollectionStep
              key={step.type}
              title={step.title}
              open={openTaskName === step.type}
              setOpen={(b) => (b ? setOpenTaskName(step.type) : setOpenTaskName(''))}
            />
          );
        }
        case 'agreement': {
          return (
            <AgreementStep
              key={step.type}
              title={step.title}
              urls={step.agreementUrls ?? []}
              open={openTaskName === step.type}
              setOpen={(b) => (b ? setOpenTaskName(step.type) : setOpenTaskName(''))}
            />
          );
        }
        default:
          return null;
      }
    })
    .filter((step) => step !== null);

  return (
    <div data-name="signup-tasks" className="divide-y divide-stone-300">
      <PrimaryProviderStep title={`Signed in with ${primaryProvider ?? 'primary provider'}`} />
      {steps}
    </div>
  );
}
