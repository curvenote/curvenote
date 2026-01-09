export function sortSignedUrlQuery(url: string) {
  let query = new URL(url).search.slice(1);
  const searchParams = new URLSearchParams(query);
  if (
    searchParams.has('URLPrefix') &&
    searchParams.has('Signature') &&
    searchParams.has('KeyName') &&
    searchParams.has('Expires')
  ) {
    console.log('Found signed URL - ensuring parameter order');
    query = `URLPrefix=${searchParams.get('URLPrefix')}&Expires=${searchParams.get(
      'Expires',
    )}&KeyName=${searchParams.get('KeyName')}&Signature=${searchParams.get('Signature')}`;
    searchParams.delete('URLPrefix');
    searchParams.delete('KeyName');
    searchParams.delete('Expires');
    searchParams.delete('Signature');
    // append any remaining params
    if (searchParams.size > 0) query += '&' + searchParams.toString();
  }
  return query;
}
