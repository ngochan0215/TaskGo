## TASKGO DESCRIPTION
A smart on-demand service platform that connects customers with trusted taskers for daily tasks such as cleaning, repairs, errands, and more. Fast, reliable, reasonable and convenient — get things done anytime, anywhere.

## TECH STACK
- Backend: Node.js, Express.js
- Frontend: HTML5, Javascript, Tailwind CSS, CSS
- Database: MongoDB 

## HOW TO RUN
### 1. Clone project
```bash
git clone https://github.com/ngochan0215/TaskGo.git
cd TaskGo
```
### 2. Run Backend
You can either run the 3rd or the 4th command line after moving to backend folder
```bash
cd backend
npm install
npm run dev  
node --watch main.js
```

### 3. Run Frontend
Remember to build the tailwind css configuration first
```bash
cd frontend
npm install
npm run build
npm run dev
```

## TEAM MEMBERS
| STT | MSSV     | Họ và Tên            | GitHub                              | Email                  |
|-----|----------|----------------------|-------------------------------------|------------------------|
| 1   | 23520436 | Phan Thị Ngọc Hân    | https://github.com/ngochan0215    | 23520436@gm.uit.edu.vn |
| 2   | 23521533 | Chế Vũ Anh Thư       | https://github.com/anhthucv       | 23521533@gm.uit.edu.vn |
| 3   | 23520702 | Phạm Bảo Khang       | https://github.com/bkhang2005     | 23520702@gm.uit.edu.vn |
| 4   | 20520387 | Nguyễn Đông Anh      | https://github.com/UIT-20520387   | 20520387@gm.uit.edu.vn |
| 5   | 23520024 | Phạm Gia An          | https://github.com/GiaAn1603      | 23520024@gm.uit.edu.vn |
| 6   | 22521322 | Trần Văn Thân        | https://github.com/vanthan04      | 22521322@gm.uit.edu.vn |
| 7   | 23521113 | Nguyễn Thị Yến Nhi   | https://github.com/insnhy         | 23521113@gm.uit.edu.vn |
| 8   | 23520950 | Phan Đức Minh        | https://github.com/MinhPhan2608   | 23520950@gm.uit.edu.vn |


## FILE .env
```bash
PORT=your_port
DB_URI=your_db_uri
JWT_SECRET=your_secret_key

SENDER_EMAIL=your_gmail
SENDER_NAME=your_name
GMAIL_APP_PASSWORD=your_gmail_app_password

HERE_API_KEY=your_here_api_key
HERE_API_SECRET_KEY=your_here_api_secret_key

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

PAYOS_CLIENT_ID=your_payos_client_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key

PAYOS_PAYOUT_CLIENT_ID=your_payos_checkout_client_id
PAYOS_PAYOUT_API_KEY=your_payos_checkout_api_key
PAYOS_PAYOUT_CHECKSUM_KEY=your_payos_checkout_checksum_key

CLIENT_URL=your_client_url
SERVER_URL=your_server_url
```
