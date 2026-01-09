import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { Logo } from './Logo.js';
import { UnsubscribeButton } from './UnsubscribeButton.js';
import type { DefaultEmailProps } from './types.js';

export interface WelcomeEmailProps {
  approval?: boolean;
}

export const WelcomeEmail = ({
  asBaseUrl,
  branding,
  unsubscribeUrl,
  approval,
}: WelcomeEmailProps & DefaultEmailProps) => {
  const platformTitle = branding?.title ?? 'Curvenote Platform';
  const previewText = approval
    ? `You can now access your ${platformTitle} account`
    : `Welcome to the ${platformTitle}!`;

  const thumbnailUrl = branding?.welcome?.videos?.[0]?.thumbnail;
  const videoTitle = branding?.welcome?.videos?.[0]?.title ?? 'Welcome Video';

  return (
    <Html>
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Head />
        <Body className="px-2 mx-auto my-auto font-sans bg-white">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Logo asBaseUrl={asBaseUrl} branding={branding} />
            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              {approval ? 'Account Approved!' : 'Welcome!'}
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              {approval
                ? `Your account has been approved and you can now access the ${platformTitle}.`
                : `Welcome to the ${platformTitle}! We're excited to have you on board.`}
            </Text>

            {thumbnailUrl && (
              <Section className="mt-[32px] mb-[32px] text-center">
                <a href={asBaseUrl('/app')} target="_blank" rel="noopener noreferrer">
                  <Img
                    src={thumbnailUrl}
                    alt={videoTitle}
                    className="mx-auto rounded border border-[#eaeaea] border-solid"
                    width="400"
                    height="225"
                  />
                </a>
              </Section>
            )}

            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                href={asBaseUrl('/app')}
              >
                Go to {platformTitle}
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
