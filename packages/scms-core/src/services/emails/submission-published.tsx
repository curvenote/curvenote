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

export interface SubmissionPublishedEmailProps {
  submissionTitle: string;
  siteTitle: string;
  publishedUrl: string;
  authorName?: string;
}

export const SubmissionPublishedEmail = ({
  asBaseUrl,
  branding,
  unsubscribeUrl,
  submissionTitle,
  siteTitle,
  publishedUrl,
  authorName,
}: SubmissionPublishedEmailProps & DefaultEmailProps) => {
  const previewText = `Your submission "${submissionTitle}" has been published`;

  return (
    <Html>
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Head />
        <Body className="px-2 mx-auto my-auto font-sans bg-white">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Logo asBaseUrl={asBaseUrl} branding={branding} />
            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              🎉 Congratulations!
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello{authorName ? ` ${authorName}` : ''},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              Your submission <strong>"{submissionTitle}"</strong> has been successfully published
              to <strong>{siteTitle}</strong>.
            </Text>

            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                href={publishedUrl}
              >
                View Published Article
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

export default SubmissionPublishedEmail;
