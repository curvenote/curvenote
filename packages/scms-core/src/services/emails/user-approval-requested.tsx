import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { Logo } from './Logo.js';
import { UnsubscribeButton } from './UnsubscribeButton.js';
import type { DefaultEmailProps } from './types.js';

export interface UserApprovalRequestedEmailProps {
  userDisplayName: string;
  userEmail: string;
  userProvider: string;
}

export const UserApprovalRequestedEmail = ({
  asBaseUrl,
  branding,
  unsubscribeUrl,
  userDisplayName,
  userEmail,
  userProvider,
}: UserApprovalRequestedEmailProps & DefaultEmailProps) => {
  const previewText = `New user approval request: ${userDisplayName} (${userEmail})`;

  return (
    <Html>
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Head />
        <Body className="px-2 mx-auto my-auto font-sans bg-white">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Logo asBaseUrl={asBaseUrl} branding={branding} />
            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              New User Approval Request
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              A new user has completed the signup process and is waiting for approval:
            </Text>

            <Section className="my-[24px] p-[16px] bg-gray-50 rounded border">
              <Text className="text-[14px] text-black leading-[24px]">
                <strong>Name:</strong> {userDisplayName}
              </Text>
              <Text className="text-[14px] text-black leading-[24px]">
                <strong>Email:</strong> {userEmail}
              </Text>
              <Text className="text-[14px] text-black leading-[24px]">
                <strong>Sign-up Provider:</strong> {userProvider}
              </Text>
            </Section>

            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                href={asBaseUrl(`/app/platform/users?search=${encodeURIComponent(userEmail)}`)}
              >
                Review & Approve
              </Button>
            </Section>

            <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
            <Section className="mt-[20px] mb-[20px] text-center">
              <UnsubscribeButton
                asBaseUrl={asBaseUrl}
                unsubscribeUrl={unsubscribeUrl}
                className="text-[#666666]"
              />
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
