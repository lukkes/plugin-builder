async function followedBySemi({ constants, URIS }) {
  const options = {
    method: "GET",
    headers: {
      Authorization: `Basic ${btoa(constants.TOKEN + ":api_token")}`,
    },
  };
  const res = await sendReq(URIS.current(constants.BASE_URI), options);
  return await res.json();
};

function *generator(params) {
  const makeIt = "happen";
}

const plugin = {
  insertText: async function(app) {
    followedBySemi({ "mymymy": "ohmy" }, [ "cat" ]);
    generator("jingle");
  }
}
