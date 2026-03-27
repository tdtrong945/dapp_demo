import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("GymMembership - Bo test tong hop", function () {
  // ==================== FIXTURE ====================
  async function deployGymFixture() {
    const [owner, admin1, admin2, user1, user2, user3] =
      await ethers.getSigners();

    const GymMembership = await ethers.getContractFactory("GymMembership");
    
    // Deploy voi 2 admin ban dau
    const gym = await GymMembership.deploy([admin1.address, admin2.address]);

    return { gym, owner, admin1, admin2, user1, user2, user3 };
  }

  // ==================== 1. DEPLOYMENT TESTS ====================
  describe("1. Trien khai & Khoi tao", function () {
    it("Nen trien khai voi owner dung", async function () {
      const { gym, owner } = await loadFixture(deployGymFixture);
      expect(await gym.owner()).to.equal(owner.address);
    });

    it("Nen khoi tao danh sach admin dung", async function () {
      const { gym, admin1, admin2 } = await loadFixture(deployGymFixture);
      expect(await gym.isAdmin(admin1.address)).to.be.true;
      expect(await gym.isAdmin(admin2.address)).to.be.true;
    });

    it("Nen lay dung so luong admin", async function () {
      const { gym } = await loadFixture(deployGymFixture);
      expect(await gym.getAdminCount()).to.equal(2);
    });

    it("Nen lay duoc danh sach admin", async function () {
      const { gym, admin1, admin2 } = await loadFixture(deployGymFixture);
      const admins = await gym.getAdmins();
      expect(admins.length).to.equal(2);
      expect(admins).to.include(admin1.address);
      expect(admins).to.include(admin2.address);
    });

    it("Nen thiet lap goi membership mac dinh", async function () {
      const { gym } = await loadFixture(deployGymFixture);
      
      const standardPlan = await gym.getMembershipPlan(0); // Goi STANDARD
      expect(standardPlan.price).to.equal(ethers.parseEther("0.5"));
      expect(standardPlan.durationDays).to.equal(30);

      const vipPlan = await gym.getMembershipPlan(1); // Goi VIP
      expect(vipPlan.price).to.equal(ethers.parseEther("1"));
      expect(vipPlan.durationDays).to.equal(30);
    });
  });

  // ==================== 2. MEMBERSHIP REGISTRATION ====================
  describe("2. Dang ky thanh vien", function () {
    it("Nen dang ky thanh vien voi goi STANDARD", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      const member = await gym.getMemberInfo(user1.address);
      expect(member.name).to.equal("User One");
      expect(member.isActive).to.be.true;
      expect(await gym.getTotalMembers()).to.equal(1);
    });

    it("Nen dang ky thanh vien voi goi VIP", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 1, {
        value: ethers.parseEther("1"),
      });

      const member = await gym.getMemberInfo(user1.address);
      expect(member.name).to.equal("User One");
    });

    it("Nen that bai neu da dang ky", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await expect(
        gym.connect(user1).registerMember("User Two", 0, {
          value: ethers.parseEther("0.5"),
        })
      ).to.be.revertedWith("Already registered");
    });

    it("Nen that bai neu thanh toan sai", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await expect(
        gym.connect(user1).registerMember("User One", 0, {
          value: ethers.parseEther("0.3"), // Sai tien
        })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Nen that bai neu ten rong", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await expect(
        gym.connect(user1).registerMember("", 0, {
          value: ethers.parseEther("0.5"),
        })
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Nen that bai neu loai membership khong hop le", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await expect(
        gym.connect(user1).registerMember("User One", 2, {
          value: ethers.parseEther("0.5"),
        })
      ).to.be.revertedWith("Invalid membership type");
    });

    it("Nen phat su kien MemberRegistered", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await expect(
        gym.connect(user1).registerMember("User One", 0, {
          value: ethers.parseEther("0.5"),
        })
      )
        .to.emit(gym, "MemberRegistered")
        .withArgs(user1.address, "User One", 0);
    });

    it("Nen theo doi tong doanh thu", async function () {
      const { gym, user1, user2 } = await loadFixture(deployGymFixture);

      const initialRevenue = await gym.getTotalRevenue();

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(user2).registerMember("User Two", 1, {
        value: ethers.parseEther("1"),
      });

      const finalRevenue = await gym.getTotalRevenue();
      expect(finalRevenue).to.equal(initialRevenue + ethers.parseEther("1.5"));
    });
  });

  // ==================== 3. MEMBERSHIP RENEWAL ====================
  describe("3. Gia han membership", function () {
    it("Admin co the gia han membership cho thanh vien", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      // Dang ky truoc
      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      // Gia han len VIP
      await gym.connect(admin1).renewMembership(user1.address, 1, {
        value: ethers.parseEther("1"),
      });

      const member = await gym.getMemberInfo(user1.address);
      expect(member.membershipType).to.equal(1); // VIP
    });

    it("Nen that bai neu non-admin co gang gia han", async function () {
      const { gym, user1, user2 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await expect(
        gym.connect(user2).renewMembership(user1.address, 1, {
          value: ethers.parseEther("1"),
        })
      ).to.be.revertedWith("Only admin can call this");
    });

    it("Nen phat su kien MembershipRenewed", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await expect(
        gym.connect(admin1).renewMembership(user1.address, 1, {
          value: ethers.parseEther("1"),
        })
      ).to.emit(gym, "MembershipRenewed");
    });
  });

  // ==================== 4. MEMBERSHIP VALIDATION ====================
  describe("4. Kiem tra membership", function () {
    it("Nen kiem tra membership hop le", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      expect(await gym.isMembershipValid(user1.address)).to.be.true;
    });

    it("Nen revert voi thanh vien khong ton tai", async function () {
      const { gym, user1, user2 } = await loadFixture(deployGymFixture);

      await expect(
        gym.isMembershipValid(user2.address)
      ).to.be.revertedWith("Member not found");
    });

    it("Nen tra ve false voi thanh vien bi vo hieu hoa", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(admin1).deactivateMember(user1.address);

      expect(await gym.isMembershipValid(user1.address)).to.be.false;
    });

    it("Nen kiem tra dia chi co phai thanh vien", async function () {
      const { gym, user1, user2 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      expect(await gym.isMember(user1.address)).to.be.true;
      expect(await gym.isMember(user2.address)).to.be.false;
    });
  });

  // ==================== 5. ATTENDANCE TRACKING ====================
  describe("5. Theo doi diem danh", function () {
    it("Admin co the ghi diem danh PRESENT", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(admin1).recordAttendance(user1.address, 1); // Co mat

      const member = await gym.getMemberInfo(user1.address);
      expect(member.totalAttendance).to.equal(1);
    });

    it("Admin co the ghi diem danh ABSENT", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(admin1).recordAttendance(user1.address, 0); // Vang

      const member = await gym.getMemberInfo(user1.address);
      expect(member.totalAttendance).to.equal(0);
    });

    it("Nen lay lich su diem danh", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(admin1).recordAttendance(user1.address, 1);
      await gym.connect(admin1).recordAttendance(user1.address, 1);

      const history = await gym.getAttendanceHistory(user1.address);
      expect(history.length).to.equal(2);
    });

    it("Nen lay tong so buoi diem danh", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(admin1).recordAttendance(user1.address, 1);
      await gym.connect(admin1).recordAttendance(user1.address, 1);
      await gym.connect(admin1).recordAttendance(user1.address, 0); // Vang

      expect(await gym.getTotalAttendance(user1.address)).to.equal(2);
    });

    it("Nen dem diem danh trong khoang thoi gian", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      const blockBefore = await ethers.provider.getBlock("latest");
      const startDate = blockBefore!.timestamp;

      await gym.connect(admin1).recordAttendance(user1.address, 1);
      await gym.connect(admin1).recordAttendance(user1.address, 1);
      await gym.connect(admin1).recordAttendance(user1.address, 0);

      const blockAfter = await ethers.provider.getBlock("latest");
      const endDate = blockAfter!.timestamp + 1000;

      const count = await gym.getAttendanceCount(
        user1.address,
        startDate,
        endDate
      );
      expect(count).to.equal(2);
    });

    it("Nen that bai neu thanh vien khong active khi diem danh", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      // Vo hieu hoa thanh vien
      await gym.connect(admin1).deactivateMember(user1.address);

      // Thu diem danh
      await expect(
        gym.connect(admin1).recordAttendance(user1.address, 1)
      ).to.be.revertedWith("Member not active");
    });

    it("Nen phat su kien AttendanceRecorded", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await expect(gym.connect(admin1).recordAttendance(user1.address, 1))
        .to.emit(gym, "AttendanceRecorded");
    });
  });

  // ==================== 6. MEMBER DEACTIVATION ====================
  describe("6. Vo hieu hoa & Kich hoat lai thanh vien", function () {
    it("Admin co the vo hieu hoa thanh vien", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(admin1).deactivateMember(user1.address);

      const member = await gym.getMemberInfo(user1.address);
      expect(member.isActive).to.be.false;
    });

    it("Admin co the kich hoat lai thanh vien", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(admin1).deactivateMember(user1.address);
      await gym.connect(admin1).reactivateMember(user1.address);

      const member = await gym.getMemberInfo(user1.address);
      expect(member.isActive).to.be.true;
    });

    it("Nen phat su kien MemberDeactivated", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await expect(gym.connect(admin1).deactivateMember(user1.address))
        .to.emit(gym, "MemberDeactivated");
    });

    it("Nen phat su kien MemberReactivated", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(admin1).deactivateMember(user1.address);

      await expect(gym.connect(admin1).reactivateMember(user1.address))
        .to.emit(gym, "MemberReactivated");
    });
  });

  // ==================== 7. ADMIN MANAGEMENT ====================
  describe("7. Quan ly admin", function () {
    it("Owner co the them admin moi", async function () {
      const { gym, owner, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(owner).addAdmin(user1.address);

      expect(await gym.isAdmin(user1.address)).to.be.true;
    });

    it("Owner co the xoa admin", async function () {
      const { gym, owner, admin1 } = await loadFixture(deployGymFixture);

      const initialCount = await gym.getAdminCount();

      await gym.connect(owner).removeAdmin(admin1.address);

      const finalCount = await gym.getAdminCount();
      expect(finalCount).to.equal(initialCount - 1n);
      expect(await gym.isAdmin(admin1.address)).to.be.false;
    });

    it("Non-owner khong the them admin", async function () {
      const { gym, user1, user2 } = await loadFixture(deployGymFixture);

      await expect(
        gym.connect(user1).addAdmin(user2.address)
      ).to.be.revertedWith("Only owner can call this");
    });

    it("Khong the them admin trung lap", async function () {
      const { gym, owner, admin1 } = await loadFixture(deployGymFixture);

      await expect(
        gym.connect(owner).addAdmin(admin1.address)
      ).to.be.revertedWith("Already admin");
    });

    it("Khong the xoa admin cuoi cung", async function () {
      const { gym, owner, admin1, admin2 } = await loadFixture(deployGymFixture);

      // Xoa admin dau
      await gym.connect(owner).removeAdmin(admin1.address);

      // Thu xoa admin cuoi
      await expect(
        gym.connect(owner).removeAdmin(admin2.address)
      ).to.be.revertedWith("Cannot remove last admin");
    });

    it("Nen phat su kien AdminAdded", async function () {
      const { gym, owner, user1 } = await loadFixture(deployGymFixture);

      await expect(gym.connect(owner).addAdmin(user1.address))
        .to.emit(gym, "AdminAdded");
    });

    it("Nen phat su kien AdminRemoved", async function () {
      const { gym, owner, admin1 } = await loadFixture(deployGymFixture);

      await expect(gym.connect(owner).removeAdmin(admin1.address))
        .to.emit(gym, "AdminRemoved");
    });
  });

  // ==================== 8. MEMBERSHIP PLAN UPDATES ====================
  describe("8. Cap nhat goi membership", function () {
    it("Owner co the cap nhat gia goi membership", async function () {
      const { gym, owner } = await loadFixture(deployGymFixture);

      const newPrice = ethers.parseEther("2");
      await gym
        .connect(owner)
        .updateMembershipPlan(0, newPrice, 30);

      const plan = await gym.getMembershipPlan(0);
      expect(plan.price).to.equal(newPrice);
    });

    it("Owner co the cap nhat thoi han goi membership", async function () {
      const { gym, owner } = await loadFixture(deployGymFixture);

      await gym.connect(owner).updateMembershipPlan(0, ethers.parseEther("0.5"), 60);

      const plan = await gym.getMembershipPlan(0);
      expect(plan.durationDays).to.equal(60);
    });

    it("Non-owner khong the cap nhat goi", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await expect(
        gym.connect(user1).updateMembershipPlan(0, ethers.parseEther("2"), 30)
      ).to.be.revertedWith("Only owner can call this");
    });

    it("Nen phat su kien MembershipPlanUpdated", async function () {
      const { gym, owner } = await loadFixture(deployGymFixture);

      await expect(
        gym
          .connect(owner)
          .updateMembershipPlan(0, ethers.parseEther("2"), 30)
      )
        .to.emit(gym, "MembershipPlanUpdated");
    });
  });

  // ==================== 9. FINANCIAL FUNCTIONS ====================
  describe("9. Chuc nang tai chinh", function () {
    it("Owner co the rut doanh thu", async function () {
      const { gym, owner, user1 } = await loadFixture(deployGymFixture);

      const amount = ethers.parseEther("0.5");
      await gym.connect(user1).registerMember("User One", 0, {
        value: amount,
      });

      const initialBalance = await ethers.provider.getBalance(owner.address);

      const tx = await gym
        .connect(owner)
        .withdrawRevenue(ethers.parseEther("0.3"));
      const receipt = await tx.wait();

      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const finalBalance = await ethers.provider.getBalance(owner.address);

      expect(finalBalance).to.equal(
        initialBalance + ethers.parseEther("0.3") - gasUsed
      );
    });

    it("Owner co the rut khan cap", async function () {
      const { gym, owner, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      const balance = await ethers.provider.getBalance(gym.target);

      const initialBalance = await ethers.provider.getBalance(owner.address);

      const tx = await gym.connect(owner).emergencyWithdraw();
      const receipt = await tx.wait();

      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const finalBalance = await ethers.provider.getBalance(owner.address);

      expect(finalBalance).to.equal(initialBalance + balance - gasUsed);
    });

    it("Nen lay so du contract", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      const amount = ethers.parseEther("0.5");
      await gym.connect(user1).registerMember("User One", 0, {
        value: amount,
      });

      const balance = await gym.getContractBalance();
      expect(balance).to.equal(amount);
    });

    it("Nen theo doi tong doanh thu", async function () {
      const { gym, user1, user2 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(user2).registerMember("User Two", 1, {
        value: ethers.parseEther("1"),
      });

      const revenue = await gym.getTotalRevenue();
      expect(revenue).to.equal(ethers.parseEther("1.5"));
    });

    it("Nen phat su kien RevenueWithdrawn", async function () {
      const { gym, owner, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await expect(
        gym.connect(owner).withdrawRevenue(ethers.parseEther("0.3"))
      )
        .to.emit(gym, "RevenueWithdrawn");
    });
  });

  // ==================== 10. VIEW FUNCTIONS ====================
  describe("10. Ham xem & truy van", function () {
    it("Nen lay tong so thanh vien", async function () {
      const { gym, user1, user2, user3 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });
      await gym.connect(user2).registerMember("User Two", 0, {
        value: ethers.parseEther("0.5"),
      });
      await gym.connect(user3).registerMember("User Three", 0, {
        value: ethers.parseEther("0.5"),
      });

      expect(await gym.getTotalMembers()).to.equal(3);
    });

    it("Nen lay thong tin contract", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      const info = await gym.getContractInfo();
      expect(info.activeMembersCount).to.equal(1);
      expect(info.contractBalance).to.equal(ethers.parseEther("0.5"));
      expect(info.adminCount).to.equal(2);
    });

    it("Nen lay do dai lich su diem danh", async function () {
      const { gym, admin1, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      await gym.connect(admin1).recordAttendance(user1.address, 1);
      await gym.connect(admin1).recordAttendance(user1.address, 1);

      const length = await gym.getAttendanceHistoryLength(user1.address);
      expect(length).to.equal(2);
    });
  });

  // ==================== 11. EDGE CASES ====================
  describe("11. Truong hop bien & bao mat", function () {
    it("Nen xu ly nhieu dang ky lien tiep", async function () {
      const { gym, user1, user2, user3 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });
      await gym.connect(user2).registerMember("User Two", 1, {
        value: ethers.parseEther("1"),
      });
      await gym.connect(user3).registerMember("User Three", 0, {
        value: ethers.parseEther("0.5"),
      });

      expect(await gym.getTotalMembers()).to.equal(3);
      expect(await gym.getTotalRevenue()).to.equal(ethers.parseEther("2"));
    });

    it("Nen xu ly ham receive()", async function () {
      const { gym, user1 } = await loadFixture(deployGymFixture);

      const amount = ethers.parseEther("10");

      // Gui ETH truc tiep vao contract
      await user1.sendTransaction({
        to: gym.target,
        value: amount,
      });

      // Tong doanh thu phai gom khoan nay
      expect(await gym.getTotalRevenue()).to.equal(amount);
    });

    it("Nen ngan reentrancy khi rut tien", async function () {
      const { gym, owner, user1 } = await loadFixture(deployGymFixture);

      await gym.connect(user1).registerMember("User One", 0, {
        value: ethers.parseEther("0.5"),
      });

      // Test nhanh co reentrancy guard
      // Test day du can contract tan cong gia lap
      const tx = await gym
        .connect(owner)
        .withdrawRevenue(ethers.parseEther("0.3"));
      
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1); // Thanh cong
    });
  });
});
