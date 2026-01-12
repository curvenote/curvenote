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

export interface CurvenoteTestEmailProps {
  recipient: string;
  message: string;
  url: string;
}

export const CurvenoteTestEmail = ({
  asBaseUrl,
  branding,
  unsubscribeUrl,
  recipient,
  message,
  url,
}: CurvenoteTestEmailProps & DefaultEmailProps) => {
  const previewText = `Curvenote Admin Test Email - ${message}`;
  const platformTitle = branding?.title ?? 'Curvenote';

  return (
    <Html>
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Head />
        <Body className="px-2 mx-auto my-auto font-sans bg-white">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Logo asBaseUrl={asBaseUrl} branding={branding} />
            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              {platformTitle} Admin Test Email
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">Hello {recipient},</Text>
            <Text className="text-[14px] text-black leading-[24px]">{message}</Text>
            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                href={url}
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
            <Text className="text-[#666666] text-[12px] leading-[24px]">
              This is a test email sent from the {platformTitle} admin system. If you received this
              email unexpectedly, please contact the system administrator.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default CurvenoteTestEmail;
