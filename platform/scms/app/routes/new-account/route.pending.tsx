import type { Route } from './+types/route.pending';
import { data, redirect, useNavigate, useSearchParams } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import {
  primitives,
  useDeploymentConfig,
  ui,
  formatAuthProviderDisplayName,
} from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';
import { SignupProgress } from './SignupProgress';
import { useEffect, useRef, useState } from 'react';
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
  // to ensure that the primary provider information is taken into account
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

  const url = new URL(args.request.url);
  const linkError = url.searchParams.get('error') === 'true' ? true : undefined;
  const linkProvider = url.searchParams.get('provider') ?? undefined;
  const linkMessage = url.searchParams.get('message') ?? undefined;

  return {
    user: ctx.user,
    currentStep,
    linkToast:
      linkError && linkProvider
        ? { type: 'error' as const, provider: linkProvider, message: linkMessage }
        : undefined,
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
  const { user, currentStep, linkToast } = loaderData;
  const { signupConfig, authProviders } = useDeploymentConfig();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const totalSteps = ((signupConfig?.signup ?? {}).steps?.length ?? 0) + 1;

  const userData = (user.data ?? {}) as UserData;
  const signupData = userData.signup ?? {};
  const answeredSteps =
    Object.values(signupData.steps ?? {}).filter((step) => step.completed).length + 1;

  const [openTaskName, setOpenTaskName] = useState<string | undefined>(currentStep);
  const linkToastShownRef = useRef<string | null>(null);

  // Show toast for linked-account auth errors (e.g. ORCID already linked to another account) and clear URL params
  useEffect(() => {
    if (!linkToast || linkToast.type !== 'error') return;
    const key = `${linkToast.provider}:${linkToast.message ?? ''}`;
    if (linkToastShownRef.current === key) return;
    linkToastShownRef.current = key;
    const message =
      linkToast.message ??
      `Could not link ${formatAuthProviderDisplayName(linkToast.provider, authProviders)} account. Please try again.`;
    ui.toastError(message);
    const next = new URLSearchParams(searchParams);
    next.delete('error');
    next.delete('provider');
    next.delete('message');
    setSearchParams(next, { replace: true });
  }, [linkToast, authProviders, searchParams, setSearchParams]);

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
      <ui.Toaster />
      <div className="flex gap-2 justify-start items-center py-2 mt-8 w-full max-w-xl sm:mt-12 lg:mt-18">
        <ListChecks className="w-6 h-6 stroke-[1px]" />
        <div className="text-xl font-light">Signup Checklist</div>
      </div>
      <div className="flex justify-center items-center w-full">
        <primitives.Card lift className="p-0 pt-8 pb-0 max-w-xl bg-white">
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
