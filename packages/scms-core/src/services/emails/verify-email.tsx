import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { Logo } from './Logo.js';
import type { DefaultEmailProps } from './types.js';

export interface VerifyEmailProps {
  verifyUrl: string;
}

export const VerifyEmail = ({
  asBaseUrl,
  branding,
  verifyUrl,
}: VerifyEmailProps & DefaultEmailProps) => {
  const platformTitle = branding?.title ?? 'Curvenote Platform';
  const previewText = `Verify your email for ${platformTitle}`;

  return (
    <Html>
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Head />
        <Body className="px-2 mx-auto my-auto font-sans bg-white">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Logo asBaseUrl={asBaseUrl} branding={branding} />
            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              Verify your email
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Please click the button below to verify your email address for your {platformTitle}{' '}
              account. This link will expire in 24 hours.
            </Text>
            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                href={verifyUrl}
              >
                Verify email address
              </Button>
            </Section>
            <Text className="text-[12px] text-[#666666] leading-[20px]">
              If you didn&apos;t create an account with us, you can safely ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
