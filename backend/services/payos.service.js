import { payOSpayment, payOSpayout } from '../config/payos.js';
import Transaction  from '../models/transaction.js';
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// Tạo payment link PayOS và lưu transaction tương ứng
export const createPayment = async (transaction, userId) => {
    // tạo orderCode cho PayOS và cho transaction nội bộ
    const orderCode = Date.now();

    const amount = Number(transaction.amount || 0);
    if (!amount || Number.isNaN(amount)) {
        throw new Error("Invalid amount for PayOS payment");
    }

    const description =
        transaction.description ||
        `Thanh toán đơn hàng ${transaction.order_id || transaction.orderId || orderCode}`;

    // chuẩn hóa items, nếu FE không gửi thì tạo 1 item mặc định
    const rawItems = Array.isArray(transaction.items) ? transaction.items : [];
    const items = (rawItems.length ? rawItems : [{
        name: transaction.item_name || description,
        quantity: 1,
        price: amount,
    }]).map(item => ({
        name: item.name || `Task ${item.taskId || ''}`.trim(),
        quantity: item.quantity || 1,
        price: Number(item.price || amount),
    }));

    const paymentData = {
        orderCode,
        amount,
        description,
        items,
        cancelUrl: 'http://localhost:3000/frontend/templates/customer/payment_pages/cancel.html',
        returnUrl: 'http://localhost:3000/frontend/templates/customer/payment_pages/success.html',
    };

    // tạo bản ghi transaction trước
    const newTransaction = await Transaction.create({
        user_id: userId,
        order_id: transaction.order_id || transaction.orderId || undefined,
        receipt_id: transaction.receipt_id || transaction.receiptId || undefined,
        order_code: orderCode,
        amount,
        description,
        type: 'payment',
        status: 'pending',
    });

    const payOSResponse = await payOSpayment.paymentRequests.create(paymentData);

    // trích data hữu ích và cập nhật lại transaction
    const data = payOSResponse?.data || payOSResponse;

    try {
        if (data?.id) {
            newTransaction.payos_payment_id = data.id;
        }
        newTransaction.raw_response = payOSResponse;

        await newTransaction.save();
    } catch (err) {
        console.error("Không thể cập nhật thông tin PayOS vào transaction:", err);
    }

    // trả về object dùng cho FE (chứa checkoutUrl, orderCode, id,...)
    return data;
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