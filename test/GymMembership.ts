
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("GymMembership API Test Suite", function () {
  // Fixture để deploy contract 1 lần và dùng lại cho mọi test cases (giúp chạy test nhanh hơn)
  async function deployGymFixture() {
    // Lấy ra các tài khoản test từ Hardhat
    const [owner, admin1, admin2, admin3, user1, user2] =
      await ethers.getSigners();

    // Khởi tạo và Deploy
    const GymMembership = await ethers.getContractFactory("GymMembership");
    // Nhúng 3 admin vào mạng test theo yêu cầu của constructor
    const gym = await GymMembership.deploy([
      admin1.address,
      admin2.address,
      admin3.address,
    ]);

    // Trả về các biến cần thiết cho các bước test sau
    return { gym, owner, admin1, admin2, admin3, user1, user2 };
  }

  describe("1. Khởi tạo (Deployment)", function () {
    it("Nên gán đúng quyền Owner", async function () {
      const { gym, owner } = await loadFixture(deployGymFixture);
      expect(await gym.owner()).to.equal(owner.address);
    });

    it("Nên cấp quyền Admin chính xác cho 3 người", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);
      expect(await gym.isAdmin(admin1.address)).to.be.true;
      // user1 không nằm trong danh sách truyền vào nên phải là false
      expect(await gym.isAdmin(user1.address)).to.be.false;
    });
  });

  describe("2. Đăng ký gói tập (Registration)", function () {
    it("User có thể đăng ký gói STANDARD nếu trả đủ tiền ETH", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      // Lấy giá trị của gói Standard ra
      const standardPlan = await gym.membershipPlans(0); // 0 là Standard
      const standardPrice = standardPlan[0]; // giá trị price nằm ở index 0

      // user1 gọi hàm đăng ký
      await gym
        .connect(user1)
        .registerMember("HocVien 1", 0, { value: standardPrice }); // 0 là Standard

      // Kiểm tra xem sau khi mua, thông tin có lưu đúng trên Blockchain không
      const memberInfo = await gym.getMemberInfo(user1.address);
      expect(memberInfo.name).to.equal("HocVien 1");
      expect(memberInfo.membershipType).to.equal(0n);
      expect(memberInfo.isActive).to.be.true;
    });

    it("Sẽ báo lỗi nếu User không trả đủ tiền", async function () {
      const { gym, user2 } = await loadFixture(deployGymFixture);

      // Trả tiền bậy (VD: 0.0001 ETH thay vì chuẩn giá)
      const wrongPrice = ethers.parseEther("0.0001");

      await expect(
        gym
          .connect(user2)
          .registerMember("HocVien 2", 1, { value: wrongPrice }), // 1 là VIP
      ).to.be.revertedWith("Incorrect payment amount"); // Phải chặn và báo lỗi theo đúng smart contract
    });
  });

  describe("3. Điểm danh (Attendance)", function () {
    it("Chỉ Admin mới có quyền điểm danh", async function () {
      const { gym, admin1, user1, user2 } = await loadFixture(deployGymFixture);

      const standardPlan = await gym.membershipPlans(0); // 0 là Standard
      const standardPrice = standardPlan[0];
      await gym
        .connect(user1)
        .registerMember("HocVien 1", 0, { value: standardPrice });

      // Admin1 điểm danh cho User1 (1 là Present - Có mặt)
      await gym.connect(admin1).recordAttendance(user1.address, 1);

      const memberInfo = await gym.getMemberInfo(user1.address);
      expect(memberInfo.totalAttendance).to.equal(1n);

      // Thử dùng chính User2 tự điểm danh cho User1 -> Phải bị chặn
      await expect(
        gym.connect(user2).recordAttendance(user1.address, 1),
      ).to.be.revertedWith("Only admin can call this"); // Báo lỗi hợp đồng
    });
  });
});
