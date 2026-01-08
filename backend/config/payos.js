import { PayOS } from '@payos/node';
import dotenv from "dotenv";


dotenv.config();
export const payOSpayment = new PayOS({
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

export const payOSpayout = new PayOS({
    clientId: process.env.PAYOS_PAYOUT_CLIENT_ID,
    apiKey: process.env.PAYOS_PAYOUT_API_KEY,
    checksumKey: process.env.PAYOS_PAYOUT_CHECKSUM_KEY,
});