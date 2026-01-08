import { payOSpayment, payOSpayout } from '../config/payos.js';
import Transaction  from '../models/transaction.js';
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

export const createPayment = async (transaction, userId) => {
    const paymentData = {
        orderCode: Date.now(),
        amount: transaction.amount,
        description: transaction.description,
        items: transaction.items.map(item => ({
            name: `Task ${item.taskId}`,
            quantity: item.quantity,
            price: item.price,
        })),
        cancelUrl: 'http://localhost:3000/payment/cancel', 
        returnUrl: 'http://localhost:3000/payment/success',
    };

    const newTransaction = await Transaction.create({
        user_id: userId,
        order_code: paymentData.orderCode,
        amount: transaction.amount,
        description: transaction.description,
        type: 'payment',
    });

    const paymentLink = await payOSpayment.paymentRequests.create(paymentData);
    return paymentLink;
}

export const getPaymentLinkDetail = async (orderId) => {
    const getPaymentDetail = await payOSpayment.paymentRequests.get(orderId);
    return getPaymentDetail;
}

export const getpaymentDetail = async (orderId) => {
    const getpaymentDetail = await Transaction.findOne({ order_code: orderId });
    return getpaymentDetail;
}

export const payOut = async (payoutData, userId) => {
    const rand = Date.now();
    const referenceId = `payout_${rand}`;
    const transaction = await Transaction.create({
        user_id: userId,
        order_code: rand,
        amount: payoutData.amount,
        description: payoutData.description,
        status: 'completed',
        type: 'payout',
    });
    const payoutBatch = await payOSpayout.payouts.batch.create({
        referenceId,
        category: ['salary'],
        validateDestination: true,
        payouts: [
            {
                referenceId: `${referenceId}_1`,
                amount: payoutData.amount,
                description: payoutData.description,
                toBin: payoutData.toBin,
                toAccountNumber: payoutData.toAccountNumber,
            }
        ],
    });

    console.log('Payout ID:', payoutBatch.id);
}

export const payoutDetailList = async () => {
    try {
        const payoutList = await payOSpayout.payouts.list();
        if (payoutList && typeof payoutList === 'object') {
            if (payoutList.data && Array.isArray(payoutList.data.payouts)) {
                return payoutList.data.payouts.map(payout => {
                    try {
                        return {
                            id: payout?.id || null,
                            referenceId: payout?.referenceId || null,
                            approvalState: payout?.approvalState || null,
                            createdAt: payout?.createdAt || null,
                            transactions: Array.isArray(payout?.transactions) 
                                ? payout.transactions.map(txn => ({
                                    id: txn?.id || null,
                                    referenceId: txn?.referenceId || null,
                                    amount: txn?.amount || 0,
                                    description: txn?.description || null,
                                    toBin: txn?.toBin || null,
                                    toAccountNumber: txn?.toAccountNumber || null,
                                    toAccountName: txn?.toAccountName || null,
                                    state: txn?.state || null
                                }))
                                : []
                        };
                    } catch (mapError) {
                        console.error('Error mapping payout:', mapError);
                        return null;
                    }
                }).filter(p => p !== null);
            }
        
            return JSON.parse(JSON.stringify(payoutList, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (key === '_client' || key === 'webhooks') return undefined;
                }
                return value;
            }));
        }
        
        return [];
    } catch (error) {
        console.error('Error in payoutDetail:', error);
        return [];
    }
}

export const payoutDetail = async (referenceId) => {
    const payoutInfo = await payOSpayout.payouts.list({ 
        referenceId : referenceId });
    try {
        if (typeof payoutInfo === 'object') {
            if (payoutInfo.data && Array.isArray(payoutInfo.data.payouts)) {
                return payoutInfo.data.payouts.map(payout => {
                    try {
                        return {
                            id: payout?.id || null,
                            referenceId: payout?.referenceId || null,
                            approvalState: payout?.approvalState || null,
                            createdAt: payout?.createdAt || null,
                            transactions: Array.isArray(payout?.transactions) 
                                ? payout.transactions.map(txn => ({
                                    id: txn?.id || null,
                                    referenceId: txn?.referenceId || null,
                                    amount: txn?.amount || 0,
                                    description: txn?.description || null,
                                    toBin: txn?.toBin || null,
                                    toAccountNumber: txn?.toAccountNumber || null,
                                    toAccountName: txn?.toAccountName || null,
                                    state: txn?.state || null
                                }))
                                : []
                        };
                    } catch (mapError) {
                        console.error('Error mapping payout:', mapError);
                        return null;
                    }
                }).filter(p => p !== null);
            }
            
            return JSON.parse(JSON.stringify(payoutInfo, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (key === '_client' || key === 'webhooks') return undefined;
                }
                return value;
            }));
        }
        
        return [];
    } catch (error) {
        console.error('Error in payoutDetail:', error);
        return [];
    }
}


export const paymentSucceeded = async(orderCode) => {
    await Transaction.findOneAndUpdate(
        { order_code: orderCode },
        { status: 'completed' },
        { new: true }
    );
}

export const paymentFailed = async(orderCode) => {
    await Transaction.findOneAndUpdate(
        { order_code: orderCode },
        { status: 'failed' },
        { new: true }
    );
}