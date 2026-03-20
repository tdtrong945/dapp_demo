// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title GymMembership
 * @dev Smart contract quản lý phòng tập gym
 * - Quản lý membership (STANDARD, VIP)
 * - Thanh toán bằng Ether
 * - Tracking attendance (điểm danh)
 * - Admin: 3 người quản lý
 */

contract GymMembership {
    
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
    
    // Danh sách admin (3 người)
    address[] public admins;
    address public owner;
    
    uint256 public totalMembers;
    uint256 public totalRevenue;
    
    // ==================== EVENTS ====================
    event MemberRegistered(address indexed memberAddress, string name, MembershipType membershipType);
    event PaymentReceived(address indexed memberAddress, uint256 amount, MembershipType membershipType);
    event AttendanceRecorded(address indexed memberAddress, uint256 date, AttendanceStatus status);
    event MembershipRenewed(address indexed memberAddress, MembershipType membershipType);
    event AdminAdded(address indexed adminAddress);
    event AdminRemoved(address indexed adminAddress);
    event MembershipPlanUpdated(MembershipType membershipType, uint256 newPrice, uint256 newDuration);
    event MemberDeactivated(address indexed memberAddress);
    
    // ==================== MODIFIERS ====================
    
    modifier onlyAdmin() {
        require(isAdmin(msg.sender), "Only admin can call this");
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
    
    // ==================== CONSTRUCTOR ====================
    
    constructor(address[] memory _admins) {
        require(_admins.length == 3, "Must have exactly 3 admins");
        
        owner = msg.sender;
        
        for (uint256 i = 0; i < 3; i++) {
            require(_admins[i] != address(0), "Invalid admin address");
            admins.push(_admins[i]);
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
        require(bytes(_name).length > 0, "Name required");
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
        
        emit MembershipRenewed(_memberAddress, membershipType);
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
        members[_memberAddress].isActive = false;
        emit MemberDeactivated(_memberAddress);
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
        require(_status <= 1, "Invalid status");
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
        uint256 count = 0;
        AttendanceRecord[] memory history = attendanceHistory[_memberAddress];
        
        for (uint256 i = 0; i < history.length; i++) {
            if (history[i].date >= _startDate && history[i].date <= _endDate && 
                history[i].status == AttendanceStatus.PRESENT) {
                count++;
            }
        }
        
        return count;
    }
    
    /**
     * @dev Lấy tổng số lần tập
     */
    function getTotalAttendance(address _memberAddress) 
        external 
        view 
        memberExists(_memberAddress) 
        returns (uint256) 
    {
        return members[_memberAddress].totalAttendance;
    }
    
    // ==================== MEMBERSHIP PLAN FUNCTIONS ====================
    
    /**
     * @dev Cập nhật gói membership (chỉ Owner)
     * @param _type Loại membership (0=STANDARD, 1=VIP)
     * @param _price Giá mới (Wei)
     * @param _durationDays Thời hạn mới (ngày)
     */
    function updateMembershipPlan(uint8 _type, uint256 _price, uint256 _durationDays) 
        external 
        onlyOwner 
    {
        require(_type <= 1, "Invalid type");
        require(_price > 0, "Price must > 0");
        require(_durationDays > 0, "Duration must > 0");
        
        MembershipType membershipType = MembershipType(_type);
        membershipPlans[membershipType].price = _price;
        membershipPlans[membershipType].durationDays = _durationDays;
        
        emit MembershipPlanUpdated(membershipType, _price, _durationDays);
    }
    
    /**
     * @dev Lấy thông tin gói membership
     */
    function getMembershipPlan(uint8 _type) 
        external 
        view 
        returns (MembershipPlan memory) 
    {
        require(_type <= 1, "Invalid type");
        return membershipPlans[MembershipType(_type)];
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @dev Kiểm tra admin
     */
    function isAdmin(address _address) public view returns (bool) {
        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == _address) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Lấy danh sách admin
     */
    function getAdmins() external view returns (address[] memory) {
        return admins;
    }
    
    /**
     * @dev Thêm admin (chỉ Owner)
     */
    function addAdmin(address _newAdmin) external onlyOwner {
        require(_newAdmin != address(0), "Invalid address");
        require(!isAdmin(_newAdmin), "Already admin");
        
        admins.push(_newAdmin);
        emit AdminAdded(_newAdmin);
    }
    
    /**
     * @dev Xóa admin (chỉ Owner)
     */
    function removeAdmin(address _admin) external onlyOwner {
        require(admins.length > 1, "Must keep at least 1 admin");
        require(isAdmin(_admin), "Not admin");
        
        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == _admin) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                emit AdminRemoved(_admin);
                break;
            }
        }
    }
    
    // ==================== FINANCIAL FUNCTIONS ====================
    
    /**
     * @dev Rút tiền (chỉ Owner)
     */
    function withdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = owner.call{value: _amount}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev Rút all tiền (chỉ Owner)
     */
    function withdrawAll() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev Lấy số dư
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Nhận Ether
     */
    receive() external payable {
        totalRevenue += msg.value;
    }
}
