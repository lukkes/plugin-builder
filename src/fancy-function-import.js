export async function followedBySemi({ constants, URIS }) {
  const options = {
    method: "GET",
    headers: {
      Authorization: `Basic ${btoa(constants.TOKEN + ":api_token")}`,
    },
  };
  const res = await sendReq(URIS.current(constants.BASE_URI), options);
  return await res.json();
};

export function *generator(params) {
  const makeIt = "happen";
}
