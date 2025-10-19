import { getToken } from "../utils/generateHereAccessToken.js"
import axios from "axios";
export const getRouteSummary = async (origin, destination) => {
  const token = await getToken(); 

  const url = "https://router.hereapi.com/v8/routes";
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      transportMode: "car",
      origin,
      destination,
      return: "summary"
    }
  });

  const summary = data.routes?.[0]?.sections?.[0]?.summary;
  return {
    distance: summary?.length ?? Number.POSITIVE_INFINITY,
    duration: summary?.duration ?? Number.POSITIVE_INFINITY
  };
};