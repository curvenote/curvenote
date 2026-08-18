import {
  PutObjectCommand,
  S3Client,
  HeadObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

async function main() {
  const client = new S3Client({
    region: 'us-east-1',
    endpoint: 'http://127.0.0.1:9000',
    forcePathStyle: true,
    credentials: { accessKeyId: 'curvenote', secretAccessKey: 'curvenote' },
  });

  const buckets = await client.send(new ListBucketsCommand({}));
  console.log(
    'buckets',
    buckets.Buckets?.map((b) => b.Name),
  );

  const key = 'smoke-test/hello.txt';
  const cmd = new PutObjectCommand({
    Bucket: 'hashstore-curvenote-dev-1',
    Key: key,
    ContentType: 'text/plain',
  });
  const url = await getSignedUrl(client, cmd, { expiresIn: 60 });
  console.log('signed host', new URL(url).host);
  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: 'hello-minio',
  });
  console.log('presigned PUT', put.status, await put.text());
  const head = await client.send(
    new HeadObjectCommand({ Bucket: 'hashstore-curvenote-dev-1', Key: key }),
  );
  console.log('head ok', head.ContentLength);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
