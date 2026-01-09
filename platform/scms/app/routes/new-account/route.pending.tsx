import type { Route } from './+types/route.pending';
import { data, redirect, useNavigate } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { primitives, useDeploymentConfig } from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';
import { SignupProgress } from './SignupProgress';
import { useEffect, useState } from 'react';
import type { UserData } from '@curvenote/scms-core';
import { ListChecks } from 'lucide-react';
import { SignupTaskList } from './SignupTaskList';
import {
  completeAgreementStep,
  completeDataCollectionStep,
  revertDataCollectionStep,
  updateLinkProvidersStep,
  updateSkipLinkProvidersStep,
  completeSignup,
  setNextStep,
  checkAccountsLinkedStatus,
} from './actionHelpers.server';
import { SignupCompletionForm } from './SignupCompletionForm';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);

  if (!ctx.user) {
    throw redirect('/login');
  }

  if (!ctx.user.pending) {
    throw redirect('/app');
  }

  if (ctx.user.ready_for_approval) {
    throw redirect('/awaiting-approval');
  }

  const userData = (ctx.user.data as UserData) ?? {};
  const signupData = userData.signup ?? {};

  // on first entry into the signup flow, we need to redirect to the check-accounts-linked step
  // to esnure that the primary provider information is taken into account
  const signupFlowHasLinkProvidersStep = ctx.$config?.app?.signup?.steps?.some(
    (step) => step.type === 'link-providers',
  );
  const signupDataHasLinkProvidersStep = signupData?.steps?.['link-providers'];
  if (signupFlowHasLinkProvidersStep && !signupDataHasLinkProvidersStep) {
    // call checkAccountsLinkedStatus function
    console.log('checkAccountsLinkedStatus - once only');
    await checkAccountsLinkedStatus(ctx);
  }

  const currentStep = signupData?.currentStep ?? ctx.$config?.app?.signup?.steps?.[0]?.type;

  return {
    user: ctx.user,
    currentStep,
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withContext(args);

  if (!ctx.user) throw redirect('/login');

  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  switch (intent) {
    case 'complete-agreement': {
      const agreementUrls =
        ctx.$config.app?.signup?.steps?.find((step) => step.type === 'agreement')?.agreementUrls ??
        [];
      const previousState = formData.get('agreedToTerms') === 'true';
      await completeAgreementStep(
        ctx,
        agreementUrls.map((item) => item.url),
        !previousState,
      );
      break;
    }
    case 'complete-data-collection':
      await completeDataCollectionStep(ctx, formData);
      break;
    case 'revert-data-collection':
      await revertDataCollectionStep(ctx);
      break;
    case 'update-link-providers':
      await updateLinkProvidersStep(ctx, formData);
      break;
    case 'skip-link-providers':
      await updateSkipLinkProvidersStep(ctx, true);
      break;
    case 'unskip-link-providers':
      await updateSkipLinkProvidersStep(ctx, false);
      break;
    case 'complete-signup': {
      const retval = await completeSignup(ctx);
      if (retval.success) {
        console.log('complete-signup - redirecting to', retval.redirectTo ?? '/app');
        throw redirect(retval.redirectTo ?? '/app');
      }
      return data({ success: false, error: retval.error }, { status: 422 });
    }
    default:
      return data(
        {
          success: false,
          error: {
            type: 'general' as const,
            message: `Unknown intent: ${intent}`,
          },
        },
        { status: 400 },
      );
  }
  await setNextStep(ctx);

  return { success: true, message: 'Signup step completed successfully.' };
}

export default function SignupPending({ loaderData }: Route.ComponentProps) {
  const { user, currentStep } = loaderData;
  const { signupConfig, authProviders } = useDeploymentConfig();
  const navigate = useNavigate();

  const totalSteps = ((signupConfig?.signup ?? {}).steps?.length ?? 0) + 1;

  const userData = (user.data ?? {}) as UserData;
  const signupData = userData.signup ?? {};
  const answeredSteps =
    Object.values(signupData.steps ?? {}).filter((step) => step.completed).length + 1;

  const [openTaskName, setOpenTaskName] = useState<string | undefined>(currentStep);
  let primaryProviderName = authProviders.find(
    (p) => p.provider === user.primaryProvider,
  )?.displayName;

  // HACK: show Google if the user is signed in with google and firebase is enabled
  if (authProviders.some((p) => p.provider === 'firebase') && user.primaryProvider === 'google') {
    primaryProviderName = 'Google';
  }

  useEffect(() => {
    if (!signupConfig) {
      navigate('/login');
    }
  }, [signupConfig, navigate]);

  useEffect(() => {
    if (currentStep !== openTaskName) {
      setOpenTaskName(currentStep);
    }
  }, [user, currentStep]);

  return (
    <div className="flex flex-col items-center w-full h-screen">
      <div className="flex items-center justify-start w-full max-w-xl gap-2 py-2 mt-8 sm:mt-12 lg:mt-18">
        <ListChecks className="w-6 h-6 stroke-[1px]" />
        <div className="text-xl font-light">Signup Checklist</div>
      </div>
      <div className="flex items-center justify-center w-full">
        <primitives.Card lift className="max-w-xl p-0 pt-8 pb-0 bg-white">
          <SignupProgress
            className="px-8 pb-6 border-b border-stone-300"
            totalSteps={totalSteps}
            answeredSteps={answeredSteps}
          />
          {signupConfig?.signup && (
            <SignupTaskList
              config={signupConfig?.signup ?? { steps: [] }}
              primaryProvider={primaryProviderName}
              openTaskName={openTaskName}
              setOpenTaskName={setOpenTaskName}
            />
          )}
          <SignupCompletionForm disabled={answeredSteps !== totalSteps} />
        </primitives.Card>
      </div>
    </div>
  );
}
