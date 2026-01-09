import {
  Body,
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

export interface RequestHelpEmailProps {
  userName: string;
  userEmail: string;
  message: string;
  currentPage?: string;
}

export const RequestHelpEmail = ({
  asBaseUrl,
  branding,
  unsubscribeUrl,
  userName,
  userEmail,
  message,
  currentPage,
}: RequestHelpEmailProps & DefaultEmailProps) => {
  const previewText = `Help requested from ${userName}`;

  return (
    <Html>
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Head />
        <Body className="px-2 mx-auto my-auto font-sans bg-white">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Logo asBaseUrl={asBaseUrl} branding={branding} />
            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              Help Request
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              A user has requested help from the application:
            </Text>
            <Section className="my-[16px] p-[16px] bg-[#f4f4f4] rounded">
              <Text className="text-[14px] text-black leading-[24px] my-0">
                <strong>Name:</strong> {userName}
              </Text>
              <Text className="text-[14px] text-black leading-[24px] my-0">
                <strong>Email:</strong> {userEmail}
              </Text>
              {currentPage && (
                <Text className="text-[14px] text-black leading-[24px] my-0">
                  <strong>Current Page:</strong> {currentPage}
                </Text>
              )}
            </Section>
            <Text className="text-[14px] text-black leading-[24px]">
              <strong>User's Message:</strong>
            </Text>
            <Section className="my-[16px] p-[16px] bg-[#f4f4f4] rounded">
              <Text className="text-[14px] text-black leading-[24px] whitespace-pre-wrap my-0">
                {message}
              </Text>
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

export default RequestHelpEmail;
