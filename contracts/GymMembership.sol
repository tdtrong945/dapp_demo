// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title GymMembership
 * @dev Smart contract quản lý phòng tập gym
 * - Quản lý membership (STANDARD, VIP)
 * - Thanh toán bằng Ether
 * - Tracking attendance (điểm danh)
 * - Admin: linh hoạt (1-N người)
 * - Safe fund transfer pattern
 * - Reentrancy protection
 * - Full event logging
 */

contract GymMembership {
    bool private locked;
    
    // ==================== STATE VARIABLES ====================
    
    // Enum loại membership
    enum MembershipType { STANDARD, VIP }
    
    // Enum trạng thái điểm danh
    enum AttendanceStatus { ABSENT, PRESENT }
    
    // Struct thông tin thành viên
    struct Member {
        address memberAddress;
        string name;
        MembershipType membershipType;
        uint256 registrationDate;
        uint256 expiryDate;
        uint256 totalAttendance;
        bool isActive;
    }
    
    // Struct bản ghi điểm danh
    struct AttendanceRecord {
        uint256 date;
        AttendanceStatus status;
    }
    
    // Struct gói membership
    struct MembershipPlan {
        uint256 price;           // Giá (Wei)
        uint256 durationDays;    // Thời hạn (ngày)
    }
    
    // Mapping
    mapping(address => Member) public members;
    mapping(address => AttendanceRecord[]) public attendanceHistory;
    mapping(MembershipType => MembershipPlan) public membershipPlans;
    mapping(address => bool) public adminList;
    
    // Danh sách admin
    address[] public admins;
    address public owner;
    
    uint256 public totalMembers;
    uint256 public totalRevenue;
    
    // ==================== EVENTS ====================
    event MemberRegistered(address indexed memberAddress, string name, MembershipType indexed membershipType);
    event MembershipRenewed(address indexed memberAddress, MembershipType indexed membershipType, uint256 newExpiryDate);
    event PaymentReceived(address indexed memberAddress, uint256 amount, MembershipType indexed membershipType);
    event AttendanceRecorded(address indexed memberAddress, uint256 indexed date, AttendanceStatus indexed status);
    event MemberDeactivated(address indexed memberAddress, uint256 timestamp);
    event MemberReactivated(address indexed memberAddress, uint256 timestamp);
    event AdminAdded(address indexed adminAddress, uint256 timestamp);
    event AdminRemoved(address indexed adminAddress, uint256 timestamp);
    event MembershipPlanUpdated(MembershipType indexed membershipType, uint256 newPrice, uint256 newDuration, uint256 timestamp);
    event RevenueWithdrawn(address indexed recipient, uint256 amount, uint256 timestamp);
    event EmergencyWithdrawal(address indexed recipient, uint256 amount, uint256 timestamp);
    
    // ==================== MODIFIERS ====================
    
    modifier reentrancyGuard() {
        require(!locked, "No reentrancy allowed");
        locked = true;
        _;
        locked = false;
    }
    
    modifier onlyAdmin() {
        require(adminList[msg.sender], "Only admin can call this");
        _;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    modifier memberExists(address _addr) {
        require(members[_addr].memberAddress != address(0), "Member not found");
        _;
    }
    
    modifier memberIsActive(address _addr) {
        require(members[_addr].isActive, "Member not active");
        _;
    }
    
    modifier validAdminCount() {
        require(admins.length > 0, "Must have at least 1 admin");
        _;
    }
    
    // ==================== CONSTRUCTOR ====================
    
    constructor(address[] memory _initialAdmins) {
        require(_initialAdmins.length > 0, "Must have at least 1 admin");
        
        owner = msg.sender;
        
        // Thêm admin ban đầu
        for (uint256 i = 0; i < _initialAdmins.length; i++) {
            require(_initialAdmins[i] != address(0), "Invalid admin address");
            require(!adminList[_initialAdmins[i]], "Duplicate admin");
            
            admins.push(_initialAdmins[i]);
            adminList[_initialAdmins[i]] = true;
        }
        
        // Thiết lập giá mặc định
        membershipPlans[MembershipType.STANDARD] = MembershipPlan({
            price: 0.5 ether,
            durationDays: 30
        });
        
        membershipPlans[MembershipType.VIP] = MembershipPlan({
            price: 1 ether,
            durationDays: 30
        });
    }
    
    // ==================== MEMBERSHIP FUNCTIONS ====================
    
    /**
     * @dev Đăng ký membership mới
     * @param _name Tên thành viên
     * @param _type Loại membership (0=STANDARD, 1=VIP)
     */
    function registerMember(string memory _name, uint8 _type) external payable {
        require(members[msg.sender].memberAddress == address(0), "Already registered");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_type <= 1, "Invalid membership type");
        
        MembershipType membershipType = MembershipType(_type);
        MembershipPlan memory plan = membershipPlans[membershipType];
        
        require(msg.value == plan.price, "Incorrect payment amount");
        
        uint256 expiryDate = block.timestamp + (plan.durationDays * 1 days);
        
        members[msg.sender] = Member({
            memberAddress: msg.sender,
            name: _name,
            membershipType: membershipType,
            registrationDate: block.timestamp,
            expiryDate: expiryDate,
            totalAttendance: 0,
            isActive: true
        });
        
        totalMembers++;
        totalRevenue += msg.value;
        
        emit MemberRegistered(msg.sender, _name, membershipType);
        emit PaymentReceived(msg.sender, msg.value, membershipType);
    }
    
    /**
     * @dev Gia hạn membership (chỉ Admin)
     * @param _memberAddress Địa chỉ thành viên
     * @param _type Loại membership mới (0=STANDARD, 1=VIP)
     */
    function renewMembership(address _memberAddress, uint8 _type) 
        external 
        payable 
        onlyAdmin 
        memberExists(_memberAddress) 
    {
        require(_type <= 1, "Invalid membership type");
        
        MembershipType membershipType = MembershipType(_type);
        MembershipPlan memory plan = membershipPlans[membershipType];
        
        require(msg.value == plan.price, "Incorrect payment amount");
        
        Member storage member = members[_memberAddress];
        member.membershipType = membershipType;
        member.expiryDate = block.timestamp + (plan.durationDays * 1 days);
        member.isActive = true;
        
        totalRevenue += msg.value;
        
        emit MembershipRenewed(_memberAddress, membershipType, member.expiryDate);
        emit PaymentReceived(_memberAddress, msg.value, membershipType);
    }
    
    /**
     * @dev Kiểm tra membership còn hiệu lực không
     */
    function isMembershipValid(address _memberAddress) 
        public 
        view 
        memberExists(_memberAddress) 
        returns (bool) 
    {
        return members[_memberAddress].expiryDate > block.timestamp && members[_memberAddress].isActive;
    }
    
    /**
     * @dev Vô hiệu hóa thành viên (chỉ Admin)
     */
    function deactivateMember(address _memberAddress) 
        external 
        onlyAdmin 
        memberExists(_memberAddress) 
    {
        require(members[_memberAddress].isActive, "Already deactivated");
        members[_memberAddress].isActive = false;
        emit MemberDeactivated(_memberAddress, block.timestamp);
    }
    
    /**
     * @dev Kích hoạt lại thành viên (chỉ Admin)
     */
    function reactivateMember(address _memberAddress) 
        external 
        onlyAdmin 
        memberExists(_memberAddress) 
    {
        require(!members[_memberAddress].isActive, "Already active");
        members[_memberAddress].isActive = true;
        emit MemberReactivated(_memberAddress, block.timestamp);
    }
    
    /**
     * @dev Lấy thông tin thành viên
     */
    function getMemberInfo(address _memberAddress) 
        external 
        view 
        memberExists(_memberAddress) 
        returns (Member memory) 
    {
        return members[_memberAddress];
    }
    
    /**
     * @dev Kiểm tra thành viên có tồn tại không
     */
    function isMember(address _memberAddress) external view returns (bool) {
        return members[_memberAddress].memberAddress != address(0);
    }
    
    /**
     * @dev Lấy thông tin gói membership
     */
    function getMembershipPlan(uint8 _type) 
        external 
        view 
        returns (MembershipPlan memory) 
    {
        require(_type <= 1, "Invalid membership type");
        return membershipPlans[MembershipType(_type)];
    }
    
    // ==================== ATTENDANCE FUNCTIONS ====================
    
    /**
     * @dev Ghi nhận điểm danh (chỉ Admin)
     * @param _memberAddress Địa chỉ thành viên
     * @param _status Trạng thái (0=ABSENT, 1=PRESENT)
     */
    function recordAttendance(address _memberAddress, uint8 _status) 
        external 
        onlyAdmin 
        memberExists(_memberAddress) 
        memberIsActive(_memberAddress) 
    {
        require(_status <= 1, "Invalid attendance status");
        require(isMembershipValid(_memberAddress), "Membership expired");
        
        AttendanceStatus status = AttendanceStatus(_status);
        
        attendanceHistory[_memberAddress].push(AttendanceRecord({
            date: block.timestamp,
            status: status
        }));
        
        if (status == AttendanceStatus.PRESENT) {
            members[_memberAddress].totalAttendance++;
        }
        
        emit AttendanceRecorded(_memberAddress, block.timestamp, status);
    }
    
    /**
     * @dev Lấy lịch sử điểm danh
     */
    function getAttendanceHistory(address _memberAddress) 
        external 
        view 
        memberExists(_memberAddress) 
        returns (AttendanceRecord[] memory) 
    {
        return attendanceHistory[_memberAddress];
    }
    
    /**
     * @dev Đếm số lần tập trong khoảng thời gian
     * @param _memberAddress Địa chỉ thành viên
     * @param _startDate Ngày bắt đầu (timestamp)
     * @param _endDate Ngày kết thúc (timestamp)
     */
    function getAttendanceCount(address _memberAddress, uint256 _startDate, uint256 _endDate) 
        external 
        view 
        memberExists(_memberAddress) 
        returns (uint256) 
    {
        require(_startDate <= _endDate, "Invalid date range");
        
        uint256 count = 0;
        AttendanceRecord[] memory history = attendanceHistory[_memberAddress];
        
        for (uint256 i = 0; i < history.length; i++) {
            if (history[i].date >= _startDate && 
                history[i].date <= _endDate && 
                history[i].status == AttendanceStatus.PRESENT) {
                count++;
            }
        }
        
        return count;
    }
    
    function getTotalAttendance(address _memberAddress) 
        external 
        view 
        memberExists(_memberAddress) 
        returns (uint256) 
    {
        return members[_memberAddress].totalAttendance;
    }
    
    /**
     * @dev Lấy tổng số bản ghi điểm danh
     */
    function getAttendanceHistoryLength(address _memberAddress)
        external
        view
        memberExists(_memberAddress)
        returns (uint256)
    {
        return attendanceHistory[_memberAddress].length;
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @dev Kiểm tra xem địa chỉ có phải admin không
     */
    function isAdmin(address _addr) public view returns (bool) {
        return adminList[_addr];
    }
    
    /**
     * @dev Lấy danh sách tất cả admin
     */
    function getAdmins() external view returns (address[] memory) {
        return admins;
    }
    
    /**
     * @dev Lấy số lượng admin
     */
    function getAdminCount() external view returns (uint256) {
        return admins.length;
    }
    
    /**
     * @dev Thêm admin mới (chỉ Owner)
     */
    function addAdmin(address _newAdmin) external onlyOwner {
        require(_newAdmin != address(0), "Invalid admin address");
        require(!adminList[_newAdmin], "Already admin");
        
        admins.push(_newAdmin);
        adminList[_newAdmin] = true;
        emit AdminAdded(_newAdmin, block.timestamp);
    }
    
    /**
     * @dev Xóa admin (chỉ Owner)
     */
    function removeAdmin(address _admin) external onlyOwner validAdminCount {
        require(adminList[_admin], "Not admin");
        require(admins.length > 1, "Cannot remove last admin");
        require(_admin != owner, "Cannot remove owner as admin");
        
        adminList[_admin] = false;
        
        // Remove from array
        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == _admin) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                break;
            }
        }
        
        emit AdminRemoved(_admin, block.timestamp);
    }
    
    /**
     * @dev Cập nhật gói membership (chỉ Owner)
     * @param _type Loại membership (0=STANDARD, 1=VIP)
     * @param _price Giá mới (Wei)
     * @param _durationDays Thời hạn mới (ngày)
     */
    function updateMembershipPlan(
        uint8 _type,
        uint256 _price,
        uint256 _durationDays
    ) external onlyOwner {
        require(_type <= 1, "Invalid membership type");
        require(_price > 0, "Price must be greater than 0");
        require(_durationDays > 0, "Duration must be greater than 0");
        
        MembershipType membershipType = MembershipType(_type);
        membershipPlans[membershipType] = MembershipPlan({
            price: _price,
            durationDays: _durationDays
        });
        
        emit MembershipPlanUpdated(membershipType, _price, _durationDays, block.timestamp);
    }
    
    // ==================== FINANCIAL FUNCTIONS ====================
    
    /**
     * @dev Rút tiền quỹ (chỉ Owner) - safe pattern with reentrancy guard
     * @param _amount Số tiền rút (Wei)
     */
    function withdrawRevenue(uint256 _amount) external onlyOwner reentrancyGuard {
        require(_amount > 0, "Amount must be greater than 0");
        require(_amount <= address(this).balance, "Insufficient contract balance");
        
        (bool success, ) = owner.call{value: _amount}("");
        require(success, "Withdrawal failed");
        
        emit RevenueWithdrawn(owner, _amount, block.timestamp);
    }
    
    /**
     * @dev Rút toàn bộ quỹ (chỉ Owner) - safe pattern
     */
    function emergencyWithdraw() external onlyOwner reentrancyGuard {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Emergency withdrawal failed");
        
        emit EmergencyWithdrawal(owner, balance, block.timestamp);
    }
    
    /**
     * @dev Lấy số dư quỹ
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Nhận Ether trực tiếp
     */
    receive() external payable {
        totalRevenue += msg.value;
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @dev Lấy tổng số member
     */
    function getTotalMembers() external view returns (uint256) {
        return totalMembers;
    }
    
    /**
     * @dev Lấy tổng doanh thu
     */
    function getTotalRevenue() external view returns (uint256) {
        return totalRevenue;
    }
    
    /**
     * @dev Lấy thông tin hđ contract
     */
    function getContractInfo() external view returns (
        uint256 contractBalance,
        uint256 activeMembersCount,
        uint256 totalDailyAttendance,
        address currentOwner,
        uint256 adminCount
    ) {
        return (
            address(this).balance,
            totalMembers,
            totalRevenue,
            owner,
            admins.length
        );
    }
}
