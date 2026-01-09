import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Hr,
} from '@react-email/components';
import { Logo } from './Logo.js';
import { UnsubscribeButton } from './UnsubscribeButton.js';
import type { DefaultEmailProps } from './types.js';

export interface GenericNotificationEmailProps {
  previewText: string;
  children: React.ReactNode;
}

/**
 * Generic notification email template that can be used by extensions
 * Provides the email wrapper (logo, container, unsubscribe) while allowing
 * extensions to compose their own content using React email components
 */
export function GenericNotificationEmail({
  asBaseUrl,
  branding,
  unsubscribeUrl,
  previewText,
  children,
}: GenericNotificationEmailProps & DefaultEmailProps) {
  return (
    <Html>
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Head />
        <Body className="px-2 mx-auto my-auto font-sans bg-white">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Logo asBaseUrl={asBaseUrl} branding={branding} />

            {/* Extension-provided content */}
            {children}

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
}

export default GenericNotificationEmail;
