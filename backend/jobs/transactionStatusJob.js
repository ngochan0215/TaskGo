import Transaction from '../models/transaction.js';
import Receipt from '../models/receipts.js';
import cron from 'node-cron';

// Chạy mỗi phút
cron.schedule('* * * * *', async () => {
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const transactions = await Transaction.find({
            status: 'pending',
            created_at: { $lte: fiveMinutesAgo }
        });
        for (const txn of transactions) {
            txn.status = 'failed';
            txn.failed_reason = 'Quá hạn thanh toán';
            txn.completed_at = new Date();
            await txn.save();

            if (txn.order_id) {
                await Receipt.findOneAndUpdate(
                    { order_id: txn.order_id },
                    { status: 'failed', transaction_id: txn._id },
                    { new: true }
                );
            }
        }
        if (transactions.length) {
            console.log(`Đã chuyển ${transactions.length} transaction quá hạn sang failed.`);
        }
    } catch (err) {
        console.error('Cron job transaction status error:', err);
    }
});

export default null;