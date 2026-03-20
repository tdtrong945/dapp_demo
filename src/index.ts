import { ethers } from "ethers";

// ==================== TYPES ====================

enum MembershipType {
  STANDARD = 0,
  VIP = 1,
}

enum AttendanceStatus {
  ABSENT = 0,
  PRESENT = 1,
}

interface Member {
  memberAddress: string;
  name: string;
  membershipType: number;
  registrationDate: bigint;
  expiryDate: bigint;
  totalAttendance: bigint;
  isActive: boolean;
}

interface AttendanceRecord {
  date: bigint;
  status: number;
}

interface MembershipPlan {
  price: bigint;
  durationDays: bigint;
}

// ==================== GYM SERVICE ====================

class GymService {
  private contractAddress: string;
  private contract: any;
  private signer: any;

  constructor(contractAddress: string, signer: any, contract: any) {
    this.contractAddress = contractAddress;
    this.signer = signer;
    this.contract = contract;
  }

  /**
   * Đăng ký membership
   */
  async registerMember(
    name: string,
    type: MembershipType,
    priceInEther: string,
  ) {
    try {
      const price = ethers.parseEther(priceInEther);
      const tx = await this.contract.registerMember(name, type, {
        value: price,
      });
      await tx.wait();
      console.log(
        `✅ Registered member: ${name} (${type === 0 ? "STANDARD" : "VIP"})`,
      );
      return tx;
    } catch (error) {
      console.error("❌ Register failed:", error);
      throw error;
    }
  }

  /**
   * Gia hạn membership (Admin only)
   */
  async renewMembership(
    memberAddress: string,
    newType: MembershipType,
    priceInEther: string,
  ) {
    try {
      const price = ethers.parseEther(priceInEther);
      const tx = await this.contract.renewMembership(memberAddress, newType, {
        value: price,
      });
      await tx.wait();
      console.log(
        `✅ Renewed membership for ${memberAddress} to ${newType === 0 ? "STANDARD" : "VIP"}`,
      );
      return tx;
    } catch (error) {
      console.error("❌ Renewal failed:", error);
      throw error;
    }
  }

  /**
   * Ghi nhận điểm danh (Admin only)
   */
  async recordAttendance(memberAddress: string, status: AttendanceStatus) {
    try {
      const tx = await this.contract.recordAttendance(memberAddress, status);
      await tx.wait();
      console.log(
        `✅ Attendance recorded: ${memberAddress} (${status === 1 ? "PRESENT" : "ABSENT"})`,
      );
      return tx;
    } catch (error) {
      console.error("❌ Attendance record failed:", error);
      throw error;
    }
  }

  /**
   * Lấy thông tin thành viên
   */
  async getMember(memberAddress: string): Promise<Member> {
    try {
      const member = await this.contract.getMemberInfo(memberAddress);
      return {
        memberAddress: member.memberAddress,
        name: member.name,
        membershipType: member.membershipType,
        registrationDate: member.registrationDate,
        expiryDate: member.expiryDate,
        totalAttendance: member.totalAttendance,
        isActive: member.isActive,
      };
    } catch (error) {
      console.error("❌ Get member failed:", error);
      throw error;
    }
  }

  /**
   * Kiểm tra membership còn hiệu lực
   */
  async isMembershipValid(memberAddress: string): Promise<boolean> {
    try {
      return await this.contract.isMembershipValid(memberAddress);
    } catch (error) {
      console.error("❌ Check membership failed:", error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử điểm danh
   */
  async getAttendanceHistory(
    memberAddress: string,
  ): Promise<AttendanceRecord[]> {
    try {
      const history = await this.contract.getAttendanceHistory(memberAddress);
      return history.map((record: any) => ({
        date: record.date,
        status: record.status,
      }));
    } catch (error) {
      console.error("❌ Get attendance history failed:", error);
      throw error;
    }
  }

  /**
   * Đếm điểm danh trong khoảng thời gian
   */
  async getAttendanceCount(
    memberAddress: string,
    startDate: number,
    endDate: number,
  ): Promise<bigint> {
    try {
      return await this.contract.getAttendanceCount(
        memberAddress,
        startDate,
        endDate,
      );
    } catch (error) {
      console.error("❌ Get attendance count failed:", error);
      throw error;
    }
  }

  /**
   * Lấy tổng số lần tập
   */
  async getTotalAttendance(memberAddress: string): Promise<bigint> {
    try {
      return await this.contract.getTotalAttendance(memberAddress);
    } catch (error) {
      console.error("❌ Get total attendance failed:", error);
      throw error;
    }
  }

  /**
   * Vô hiệu hóa thành viên (Admin only)
   */
  async deactivateMember(memberAddress: string) {
    try {
      const tx = await this.contract.deactivateMember(memberAddress);
      await tx.wait();
      console.log(`✅ Deactivated member: ${memberAddress}`);
      return tx;
    } catch (error) {
      console.error("❌ Deactivate failed:", error);
      throw error;
    }
  }

  /**
   * Cập nhật membership plan (Owner only)
   */
  async updateMembershipPlan(
    type: MembershipType,
    priceInEther: string,
    durationDays: number,
  ) {
    try {
      const price = ethers.parseEther(priceInEther);
      const tx = await this.contract.updateMembershipPlan(
        type,
        price,
        durationDays,
      );
      await tx.wait();
      console.log(
        `✅ Updated ${type === 0 ? "STANDARD" : "VIP"} plan: ${priceInEther} ETH / ${durationDays} days`,
      );
      return tx;
    } catch (error) {
      console.error("❌ Update plan failed:", error);
      throw error;
    }
  }

  /**
   * Lấy thông tin membership plan
   */
  async getMembershipPlan(type: MembershipType): Promise<MembershipPlan> {
    try {
      const plan = await this.contract.getMembershipPlan(type);
      return {
        price: plan.price,
        durationDays: plan.durationDays,
      };
    } catch (error) {
      console.error("❌ Get plan failed:", error);
      throw error;
    }
  }

  /**
   * Kiểm tra admin
   */
  async isAdmin(address: string): Promise<boolean> {
    try {
      return await this.contract.isAdmin(address);
    } catch (error) {
      console.error("❌ Check admin failed:", error);
      throw error;
    }
  }

  /**
   * Lấy danh sách admin
   */
  async getAdmins(): Promise<string[]> {
    try {
      return await this.contract.getAdmins();
    } catch (error) {
      console.error("❌ Get admins failed:", error);
      throw error;
    }
  }

  /**
   * Thêm admin (Owner only)
   */
  async addAdmin(newAdmin: string) {
    try {
      const tx = await this.contract.addAdmin(newAdmin);
      await tx.wait();
      console.log(`✅ Added admin: ${newAdmin}`);
      return tx;
    } catch (error) {
      console.error("❌ Add admin failed:", error);
      throw error;
    }
  }

  /**
   * Rút tiền (Owner only)
   */
  async withdraw(amountInEther: string) {
    try {
      const amount = ethers.parseEther(amountInEther);
      const tx = await this.contract.withdraw(amount);
      await tx.wait();
      console.log(`✅ Withdrawn ${amountInEther} ETH`);
      return tx;
    } catch (error) {
      console.error("❌ Withdraw failed:", error);
      throw error;
    }
  }

  /**
   * Rút tất cả tiền (Owner only)
   */
  async withdrawAll() {
    try {
      const tx = await this.contract.withdrawAll();
      await tx.wait();
      console.log("✅ Withdrew all funds");
      return tx;
    } catch (error) {
      console.error("❌ Withdraw all failed:", error);
      throw error;
    }
  }

  /**
   * Lấy số dư contract
   */
  async getBalance(): Promise<string> {
    try {
      const balance = await this.contract.getBalance();
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("❌ Get balance failed:", error);
      throw error;
    }
  }

  /**
   * Kiểm tra thành viên tồn tại
   */
  async isMember(memberAddress: string): Promise<boolean> {
    try {
      return await this.contract.isMember(memberAddress);
    } catch (error) {
      console.error("❌ Check member failed:", error);
      throw error;
    }
  }
}

// ==================== EXPORTS ====================

export {
  GymService,
  MembershipType,
  AttendanceStatus,
  Member,
  AttendanceRecord,
  MembershipPlan,
};
